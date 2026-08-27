import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildSummaryData, generateSummary } from '@/lib/summaryGenerator';
import { getLLMClient } from '@/lib/llmClient';
import { getCurrentMonthPeriod } from '@/utils/dateUtils';
import { Category } from '@/models/category';
import { getUserCurrency } from '@/lib/userCurrency';

export const dynamic = 'force-dynamic';

/**
 * GET /api/summary
 * Generates a plain-language financial summary for the current period using LLM.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Authenticate user — validated once already, in middleware
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentPeriod = getCurrentMonthPeriod();

    // Query income transactions for current period
    const { data: incomeTransactions, error: incomeError } = await supabase
      .from('transactions')
      .select('amount, date')
      .eq('type', 'income')
      .gte('date', currentPeriod.start)
      .lte('date', currentPeriod.end);

    if (incomeError) {
      console.error('[GET /api/summary] Failed to fetch income data:', incomeError.message);
      return NextResponse.json(
        { error: 'Failed to fetch income data' },
        { status: 500 }
      );
    }

    // Query expense transactions for current period
    const { data: expenseTransactions, error: expenseError } = await supabase
      .from('transactions')
      .select('amount, category, date')
      .eq('type', 'expense')
      .gte('date', currentPeriod.start)
      .lte('date', currentPeriod.end);

    if (expenseError) {
      console.error('[GET /api/summary] Failed to fetch expense data:', expenseError.message);
      return NextResponse.json(
        { error: 'Failed to fetch expense data' },
        { status: 500 }
      );
    }

    // Query current budget allocations
    const { data: budgets } = await supabase
      .from('budgets')
      .select('allocations')
      .lte('period_start', currentPeriod.end)
      .gte('period_end', currentPeriod.start)
      .order('created_at', { ascending: false })
      .limit(1);

    const budgetAllocations = budgets && budgets.length > 0
      ? (budgets[0].allocations as Array<{ category: string; amount: number; is_fixed: boolean }>)
      : undefined;

    // Query savings goal
    const { data: savingsGoals } = await supabase
      .from('savings_goals')
      .select('target_amount, current_amount')
      .order('created_at', { ascending: false })
      .limit(1);

    const savingsGoal = savingsGoals && savingsGoals.length > 0
      ? { target: savingsGoals[0].target_amount, current: savingsGoals[0].current_amount }
      : undefined;

    // Check if we have enough data
    if (
      (!incomeTransactions || incomeTransactions.length === 0) &&
      (!expenseTransactions || expenseTransactions.length === 0)
    ) {
      return NextResponse.json(
        { error: 'Not enough data for summary' },
        { status: 404 }
      );
    }

    // Build summary data
    const summaryData = buildSummaryData({
      income: (incomeTransactions ?? []).map((t) => ({
        amount: t.amount,
        date: t.date,
      })),
      expenses: (expenseTransactions ?? []).map((t) => ({
        amount: t.amount,
        category: t.category as Category,
        date: t.date,
      })),
      budget: budgetAllocations?.map((a) => ({
        category: a.category as Category,
        amount: a.amount,
      })),
      savingsGoal,
      periodType: 'monthly',
      periodLabel: `${currentPeriod.start} to ${currentPeriod.end}`,
    });

    // Generate summary with LLM
    const llmClient = getLLMClient();
    const currency = getUserCurrency(request.headers.get('x-user-currency'));
    const summary = await generateSummary(summaryData, true, llmClient, currency);

    return NextResponse.json({
      summary,
      data: summaryData,
    });
  } catch (error) {
    console.error('[GET /api/summary] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
