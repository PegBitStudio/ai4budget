import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CreateTransactionSchema } from '@/models/transaction';
import { Category } from '@/models/category';
import { classify } from '@/lib/classifier';
import { getLLMClient } from '@/lib/llmClient';
import { checkAlerts } from '@/lib/alertEngine';
import { getCurrentMonthPeriod, getCurrentWeekPeriod } from '@/utils/dateUtils';
import { parseListQuery } from '@/lib/transactionQuery';

export const dynamic = 'force-dynamic';

/**
 * POST /api/transactions
 * Create a new transaction with auto-classification and budget alert checking.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate body
    const body = await request.json();
    const validation = CreateTransactionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { amount, date, description, type, source } = validation.data;

    // Load user corrections from classification_rules table
    const { data: userRules } = await supabase
      .from('classification_rules')
      .select('description, category')
      .eq('user_id', user.id);

    const userCorrections = new Map<string, Category>();
    if (userRules) {
      for (const rule of userRules) {
        userCorrections.set(rule.description, rule.category as Category);
      }
    }

    // Classify the transaction
    const llmClient = getLLMClient();
    const llmClassify = llmClient.isAvailable()
      ? (desc: string) => llmClient.classifyTransaction(desc)
      : undefined;

    const classification = await classify(description, userCorrections, llmClassify);

    // Insert transaction into database
    const { data: transaction, error: insertError } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        amount,
        date,
        description,
        category: classification.category,
        type,
        source: source ?? null,
        is_manual_category: false,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: 'Failed to create transaction', details: insertError.message },
        { status: 500 }
      );
    }

    // Check for budget alerts (only for expenses)
    if (type === 'expense') {
      await checkBudgetAlerts(supabase, user.id, classification.category, date);
    }

    return NextResponse.json(
      { transaction, classification_source: classification.source },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/transactions] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/transactions?all=true
 * Delete ALL of the authenticated user's data (transactions, budgets, savings goals, commitments, alerts, classification rules).
 * Only works when ?all=true is provided. Must complete within 5 seconds.
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const all = searchParams.get('all');

    if (all !== 'true') {
      return NextResponse.json(
        { error: 'Must provide ?all=true to delete all data' },
        { status: 400 }
      );
    }

    // Delete all user data from all tables (RLS ensures user isolation)
    // Order matters: delete dependent data first
    const deleteFrom = async (table: string) => {
      const { error } = await supabase
        .from(table as 'transactions')
        .delete()
        .eq('user_id', user.id);
      return error;
    };

    const tablesToDelete = [
      'spending_alerts',
      'classification_rules',
      'transactions',
      'budgets',
      'savings_goals',
      'commitments',
    ];

    for (const table of tablesToDelete) {
      const error = await deleteFrom(table);
      if (error) {
        console.error(`[DELETE /api/transactions?all=true] Failed to delete from ${table}:`, error);
        return NextResponse.json(
          { error: `Failed to delete data from ${table}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { message: 'All data deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('[DELETE /api/transactions?all=true] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/transactions
 * List user's transactions with optional filters and pagination.
 * Query params: ?category=X&from=YYYY-MM-DD&to=YYYY-MM-DD&type=income|expense&limit=N&offset=N
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const {
      category,
      from,
      to,
      type,
      search,
      limit,
      offset,
      sort,
      ascending,
    } = parseListQuery(searchParams);

    // Build query — RLS ensures user only gets their own data
    let query = supabase
      .from('transactions')
      .select('*', { count: 'exact' });

    if (category) {
      query = query.eq('category', category);
    }
    if (from) {
      query = query.gte('date', from);
    }
    if (to) {
      query = query.lte('date', to);
    }
    if (type) {
      query = query.eq('type', type);
    }
    if (search) {
      query = query.ilike('description', `%${search}%`);
    }

    query = query
      .order(sort, { ascending })
      // A stable tiebreak, so paging cannot show the same row twice.
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: transactions, count, error: queryError } = await query;

    if (queryError) {
      return NextResponse.json(
        { error: 'Failed to fetch transactions', details: queryError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { transactions: transactions ?? [], total: count ?? 0 },
      { status: 200 }
    );
  } catch (error) {
    console.error('[GET /api/transactions] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// --- Helper: Check budget alerts after transaction insert ---

async function checkBudgetAlerts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  category: Category,
  transactionDate: string
) {
  try {
    // Determine current budget period for the transaction date
    // Try monthly first, then weekly
    const monthPeriod = getCurrentMonthPeriod();
    const weekPeriod = getCurrentWeekPeriod();

    // Look for an active budget covering the transaction date
    const { data: budgets } = await supabase
      .from('budgets')
      .select('*')
      .lte('period_start', transactionDate)
      .gte('period_end', transactionDate)
      .limit(1);

    if (!budgets || budgets.length === 0) {
      return; // No budget for this period — no alerts
    }

    const budget = budgets[0];
    const allocations = budget.allocations as Array<{
      category: string;
      amount: number;
      is_fixed: boolean;
    }>;

    // Find the allocation for this category
    const allocation = allocations.find((a) => a.category === category);
    if (!allocation) {
      return; // No budget for this category
    }

    // Calculate total spending for this category in the budget period
    const { data: categoryTransactions } = await supabase
      .from('transactions')
      .select('amount')
      .eq('type', 'expense')
      .eq('category', category)
      .gte('date', budget.period_start)
      .lte('date', budget.period_end);

    const categoryTotalSpent = (categoryTransactions ?? []).reduce(
      (sum, t) => sum + t.amount,
      0
    );

    // Get existing alerts for this category/period
    const { data: existingAlerts } = await supabase
      .from('spending_alerts')
      .select('category, type, period_start')
      .eq('category', category)
      .eq('period_start', budget.period_start);

    // Check if new alerts should be generated
    const newAlerts = checkAlerts({
      category,
      categoryTotalSpent,
      budgetedAmount: allocation.amount,
      existingAlerts: (existingAlerts ?? []).map((a) => ({
        category: a.category as Category,
        type: a.type as 'warning' | 'exceeded',
        period_start: a.period_start,
      })),
      periodStart: budget.period_start,
    });

    // Insert new alerts
    if (newAlerts.length > 0) {
      await supabase.from('spending_alerts').insert(
        newAlerts.map((alert) => ({
          user_id: userId,
          category: alert.category,
          type: alert.type,
          amount_spent: alert.amount_spent,
          budgeted_amount: alert.budgeted_amount,
          period_start: alert.period_start,
        }))
      );
    }
  } catch (error) {
    // Alert generation failure should not block the transaction response
    console.error('[checkBudgetAlerts] Error:', error);
  }
}
