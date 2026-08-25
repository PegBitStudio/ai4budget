import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  detectAnomalies,
  detectIncreasingCategories,
  getComparison,
  generateExplanation,
  generateTrendExplanation,
} from '@/lib/spendingAnalyser';
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
      return NextResponse.json(
        { error: 'Failed to fetch current transactions', details: currentError.message },
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
      return NextResponse.json(
        { error: 'Failed to fetch previous transactions', details: previousError.message },
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
      return NextResponse.json(
        { error: 'Failed to fetch transaction history', details: allError.message },
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
      return NextResponse.json(
        { error: 'Failed to fetch budget comparison', details: budgetError.message },
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

    // Generate explanations
    const anomaliesWithExplanation = anomalies.map((anomaly) => ({
      ...anomaly,
      explanation: generateExplanation(anomaly),
    }));

    const trendsWithExplanation = trends.map((trend) => ({
      ...trend,
      explanation: generateTrendExplanation(trend),
    }));

    const hasPatterns = anomaliesWithExplanation.length > 0 || trendsWithExplanation.length > 0;

    if (!hasPatterns) {
      return NextResponse.json({
        anomalies: [],
        trends: [],
        comparison,
        hasPatterns: false,
        message: 'No unusual spending patterns found',
      });
    }

    return NextResponse.json({
      anomalies: anomaliesWithExplanation,
      trends: trendsWithExplanation,
      comparison,
      hasPatterns: true,
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
