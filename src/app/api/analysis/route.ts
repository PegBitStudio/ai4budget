import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  detectAnomalies,
  detectIncreasingCategories,
  detectRecurringCharges,
  getComparison,
  generateExplanation,
  generateTrendExplanation,
} from '@/lib/spendingAnalyser';
import { getGoalImpact } from '@/lib/savingsAdvisor';
import {
  getCurrentMonthPeriod,
  getCurrentWeekPeriod,
  getPreviousPeriod,
} from '@/utils/dateUtils';
import { Category } from '@/models/category';
import { PeriodTypeSchema } from '@/models/budget';

export const dynamic = 'force-dynamic';

/**
 * GET /api/analysis
 * Detects spending anomalies and increasing category trends for the current period.
 */
export async function GET(request: Request) {
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

    // Keep analysis and the selected budget on the same timeframe.
    const { searchParams } = new URL(request.url);
    const periodTypeResult = PeriodTypeSchema.safeParse(
      searchParams.get('period_type') ?? 'monthly'
    );

    if (!periodTypeResult.success) {
      return NextResponse.json(
        { error: 'Invalid period_type. Must be "weekly" or "monthly".' },
        { status: 400 }
      );
    }

    const periodType = periodTypeResult.data;
    const currentPeriod =
      periodType === 'weekly' ? getCurrentWeekPeriod() : getCurrentMonthPeriod();
    const previousPeriod = getPreviousPeriod(currentPeriod.start, periodType);

    // Query transactions for current period (expenses only)
    const { data: currentTransactions, error: currentError } = await supabase
      .from('transactions')
      .select('id, amount, category, date, description, type')
      .eq('type', 'expense')
      .gte('date', currentPeriod.start)
      .lte('date', currentPeriod.end)
      .order('date', { ascending: false });

    if (currentError) {
      console.error('[GET /api/analysis] Failed to fetch current transactions:', currentError.message);
      return NextResponse.json(
        { error: 'Failed to fetch current transactions' },
        { status: 500 }
      );
    }

    // Query transactions for previous period (expenses only, for trend comparison)
    const { data: previousTransactions, error: previousError } = await supabase
      .from('transactions')
      .select('amount, category')
      .eq('type', 'expense')
      .gte('date', previousPeriod.start)
      .lte('date', previousPeriod.end);

    if (previousError) {
      console.error('[GET /api/analysis] Failed to fetch previous transactions:', previousError.message);
      return NextResponse.json(
        { error: 'Failed to fetch previous transactions' },
        { status: 500 }
      );
    }

    // Query all transactions for the anomaly baseline. Description and date are
    // needed to recognise recurring charges, which are never anomalies.
    const { data: allTransactions, error: allError } = await supabase
      .from('transactions')
      .select('amount, category, description, date')
      .eq('type', 'expense');

    if (allError) {
      console.error('[GET /api/analysis] Failed to fetch transaction history:', allError.message);
      return NextResponse.json(
        { error: 'Failed to fetch transaction history' },
        { status: 500 }
      );
    }

    // Detect anomalies
    const anomalies = detectAnomalies(
      (currentTransactions ?? []).map((t) => ({
        id: t.id,
        amount: t.amount,
        category: t.category as Category,
        date: t.date,
        description: t.description,
      })),
      (allTransactions ?? []).map((t) => ({
        amount: t.amount,
        category: t.category as Category,
        description: t.description,
        date: t.date,
      }))
    );

    // Aggregate spending by category for current period
    const currentCategorySpending = aggregateByCategory(currentTransactions ?? []);
    // Aggregate spending by category for previous period
    const previousCategorySpending = aggregateByCategory(previousTransactions ?? []);

    // A budget comparison is the source of truth for the Budget screen. It must
    // use the exact active budget period, not a client-side zero-value fallback.
    const { data: budget, error: budgetError } = await supabase
      .from('budgets')
      .select('allocations')
      .eq('period_type', periodType)
      .eq('period_start', currentPeriod.start)
      .eq('period_end', currentPeriod.end)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (budgetError) {
      console.error('[GET /api/analysis] Failed to fetch budget comparison:', budgetError.message);
      return NextResponse.json(
        { error: 'Failed to fetch budget comparison' },
        { status: 500 }
      );
    }

    const comparison = budget
      ? getComparison(
          budget.allocations as unknown as import('@/models/budget').CategoryAllocation[],
          currentCategorySpending
        )
      : [];

    // Detect increasing categories
    const trends = detectIncreasingCategories(
      currentCategorySpending,
      previousCategorySpending
    );

    // The user's savings goal, so spending can be reported as what it costs in
    // progress rather than only as a figure.
    const { data: savingsGoals } = await supabase
      .from('savings_goals')
      .select('target_amount, current_amount, monthly_contribution, deadline')
      .order('created_at', { ascending: false })
      .limit(1);

    const goal = savingsGoals?.[0]
      ? {
          targetAmount: Number(savingsGoals[0].target_amount),
          currentAmount: Number(savingsGoals[0].current_amount),
          monthlyContribution: Number(savingsGoals[0].monthly_contribution),
          deadline: savingsGoals[0].deadline ?? undefined,
        }
      : undefined;

    // Generate explanations
    const anomaliesWithExplanation = anomalies.map((anomaly) => ({
      ...anomaly,
      explanation: generateExplanation(anomaly),
      goalImpact: getGoalImpact(anomaly.transaction.amount, goal),
    }));

    const trendsWithExplanation = trends.map((trend) => ({
      ...trend,
      explanation: generateTrendExplanation(trend),
    }));

    // Money leaving on autopilot, drawn from the same history as the anomaly
    // baseline. This is the "unnecessary" half of the brief: charges that
    // repeat every month are invisible in a list sorted by date.
    const recurring = detectRecurringCharges(
      (allTransactions ?? []).map((t) => ({
        amount: t.amount,
        category: t.category as Category,
        description: t.description,
        date: t.date,
      }))
    );

    // What the creep in recurring charges costs over a year. increaseAmount is
    // a monthly figure, and a monthly increase left alone is paid twelve times
    // — so the annual total is what the delay must be measured against.
    const recurringGoalImpact = getGoalImpact(recurring.increaseAmount * 12, goal);

    const hasPatterns =
      anomaliesWithExplanation.length > 0 ||
      trendsWithExplanation.length > 0 ||
      recurring.charges.length > 0;

    return NextResponse.json({
      anomalies: anomaliesWithExplanation,
      trends: trendsWithExplanation,
      recurring: { ...recurring, goalImpact: recurringGoalImpact },
      comparison,
      hasPatterns,
      ...(hasPatterns
        ? {}
        : { message: 'No unusual spending patterns found' }),
    });
  } catch (error) {
    console.error('[GET /api/analysis] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// --- Helper: Aggregate transaction amounts by category ---

function aggregateByCategory(
  transactions: { amount: number; category: string }[]
): { category: Category; total: number }[] {
  const map = new Map<string, number>();

  for (const t of transactions) {
    const current = map.get(t.category) ?? 0;
    map.set(t.category, current + t.amount);
  }

  return Array.from(map.entries()).map(([category, total]) => ({
    category: category as Category,
    total,
  }));
}
