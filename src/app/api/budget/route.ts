import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateBudget, modifyAllocation, Frequency } from '@/lib/budgetEngine';
import { CategorySchema } from '@/models/category';
import { PeriodTypeSchema } from '@/models/budget';
import {
  getCurrentMonthPeriod,
  getCurrentWeekPeriod,
  getPreviousPeriod,
} from '@/utils/dateUtils';
import type { Json } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

/**
 * POST /api/budget
 * Generate a new budget for the current period based on income,
 * commitments, savings goals, and historical spending.
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
    const periodValidation = PeriodTypeSchema.safeParse(body?.period_type);

    if (!periodValidation.success) {
      return NextResponse.json(
        { error: 'Invalid period_type. Must be "weekly" or "monthly".' },
        { status: 400 }
      );
    }

    const periodType = periodValidation.data;

    // Calculate current period
    const currentPeriod =
      periodType === 'monthly'
        ? getCurrentMonthPeriod()
        : getCurrentWeekPeriod();

    // 1. Query total income for the period (sum of income transactions in current period)
    const { data: incomeTransactions, error: incomeError } = await supabase
      .from('transactions')
      .select('amount')
      .eq('type', 'income')
      .gte('date', currentPeriod.start)
      .lte('date', currentPeriod.end);

    if (incomeError) {
      return NextResponse.json(
        { error: 'Failed to query income data', details: incomeError.message },
        { status: 500 }
      );
    }

    const totalIncome = (incomeTransactions ?? []).reduce(
      (sum, t) => sum + Number(t.amount),
      0
    );

    // 2. Query user's financial commitments
    const { data: commitments, error: commitmentsError } = await supabase
      .from('commitments')
      .select('amount, frequency');

    if (commitmentsError) {
      return NextResponse.json(
        { error: 'Failed to query commitments', details: commitmentsError.message },
        { status: 500 }
      );
    }

    // 3. Query savings goals (sum of monthly_contribution)
    const { data: savingsGoals, error: savingsError } = await supabase
      .from('savings_goals')
      .select('monthly_contribution');

    if (savingsError) {
      return NextResponse.json(
        { error: 'Failed to query savings goals', details: savingsError.message },
        { status: 500 }
      );
    }

    const totalSavingsContribution = (savingsGoals ?? []).reduce(
      (sum, g) => sum + Number(g.monthly_contribution),
      0
    );

    // 4. Query historical spending (group expenses by category for the most recent complete period)
    const previousPeriod = getPreviousPeriod(currentPeriod.start, periodType);

    let { data: historicalTransactions } = await supabase
      .from('transactions')
      .select('category, amount')
      .eq('type', 'expense')
      .gte('date', previousPeriod.start)
      .lte('date', previousPeriod.end);

    // A first-time user has no previous period, and the flat heuristic that
    // fills the gap allocates rent the same share as pharmacy visits — so the
    // very first budget they are shown is wrong about their largest cost.
    // Anything already recorded this period is better signal than nothing.
    if (!historicalTransactions || historicalTransactions.length === 0) {
      const { data: currentTransactions } = await supabase
        .from('transactions')
        .select('category, amount')
        .eq('type', 'expense')
        .gte('date', currentPeriod.start)
        .lte('date', currentPeriod.end);

      historicalTransactions = currentTransactions;
    }

    // Group historical spending by category
    let historicalSpending: { category: string; amount: number }[] | undefined;

    if (historicalTransactions && historicalTransactions.length > 0) {
      const categoryTotals = new Map<string, number>();
      for (const t of historicalTransactions) {
        const current = categoryTotals.get(t.category) ?? 0;
        categoryTotals.set(t.category, current + Number(t.amount));
      }
      historicalSpending = Array.from(categoryTotals.entries()).map(
        ([category, amount]) => ({ category, amount })
      );
    }

    // 5. Call generateBudget() from budgetEngine
    const budgetResult = generateBudget({
      totalIncome,
      commitments: (commitments ?? []).map((c) => ({
        amount: Number(c.amount),
        frequency: c.frequency as Frequency,
      })),
      savingsContribution: totalSavingsContribution,
      periodType,
      historicalSpending: historicalSpending as
        | { category: import('@/models/category').Category; amount: number }[]
        | undefined,
    });

    // 6. If the budget could not be built, say which situation stopped it
    if (!budgetResult.success) {
      return NextResponse.json(
        {
          error: budgetResult.error,
          shortfall: budgetResult.shortfall,
          reason: budgetResult.reason,
        },
        { status: 422 }
      );
    }

    // 7. Store the generated budget in the budgets table
    const { data: createdBudget, error: insertError } = await supabase
      .from('budgets')
      .insert({
        user_id: user.id,
        period_type: periodType,
        period_start: currentPeriod.start,
        period_end: currentPeriod.end,
        total_income: totalIncome,
        allocations: budgetResult.allocations as unknown as Json,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: 'Failed to store budget', details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(createdBudget, { status: 201 });
  } catch (error) {
    console.error('[POST /api/budget] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/budget
 * Retrieve the current budget for the authenticated user.
 * Query param: ?period_type=weekly|monthly (default: monthly)
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
    const periodTypeParam = searchParams.get('period_type') ?? 'monthly';

    const periodValidation = PeriodTypeSchema.safeParse(periodTypeParam);
    if (!periodValidation.success) {
      return NextResponse.json(
        { error: 'Invalid period_type. Must be "weekly" or "monthly".' },
        { status: 400 }
      );
    }

    const periodType = periodValidation.data;

    // Calculate the current period
    const currentPeriod =
      periodType === 'monthly'
        ? getCurrentMonthPeriod()
        : getCurrentWeekPeriod();

    // Query the budgets table for the user matching the current period
    const { data: budget, error: queryError } = await supabase
      .from('budgets')
      .select('*')
      .eq('period_type', periodType)
      .eq('period_start', currentPeriod.start)
      .eq('period_end', currentPeriod.end)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (queryError) {
      return NextResponse.json(
        { error: 'Failed to fetch budget', details: queryError.message },
        { status: 500 }
      );
    }

    if (!budget) {
      return NextResponse.json(
        { error: 'No budget found for current period' },
        { status: 404 }
      );
    }

    return NextResponse.json(budget, { status: 200 });
  } catch (error) {
    console.error('[GET /api/budget] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/budget
 * Modify a single category allocation in the current budget.
 * Body: { category: Category, amount: number }
 */
export async function PATCH(request: NextRequest) {
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

    const categoryValidation = CategorySchema.safeParse(body?.category);
    if (!categoryValidation.success) {
      return NextResponse.json(
        { error: 'Invalid category' },
        { status: 400 }
      );
    }

    const amount = body?.amount;
    if (typeof amount !== 'number' || amount < 0) {
      return NextResponse.json(
        { error: 'Invalid amount. Must be a non-negative number.' },
        { status: 400 }
      );
    }

    const category = categoryValidation.data;

    // Load the most recent budget for the user
    const { data: budget, error: queryError } = await supabase
      .from('budgets')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (queryError) {
      return NextResponse.json(
        { error: 'Failed to fetch budget', details: queryError.message },
        { status: 500 }
      );
    }

    if (!budget) {
      return NextResponse.json(
        { error: 'No budget found for current period' },
        { status: 404 }
      );
    }

    // Call modifyAllocation from budgetEngine
    const currentAllocations = budget.allocations as Array<{
      category: string;
      amount: number;
      is_fixed: boolean;
    }>;

    // Calculate available income (total_income minus fixed commitments already accounted for in generation)
    const availableIncome = currentAllocations.reduce(
      (sum, a) => sum + a.amount,
      0
    );

    const updatedAllocations = modifyAllocation(
      currentAllocations as import('@/models/budget').CategoryAllocation[],
      category,
      amount,
      availableIncome
    );

    // Update the budget in the database
    const { data: updatedBudget, error: updateError } = await supabase
      .from('budgets')
      .update({ allocations: updatedAllocations as unknown as Json })
      .eq('id', budget.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update budget', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedBudget, { status: 200 });
  } catch (error) {
    console.error('[PATCH /api/budget] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
