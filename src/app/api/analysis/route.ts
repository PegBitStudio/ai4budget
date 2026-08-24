import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  detectAnomalies,
  detectIncreasingCategories,
  generateExplanation,
  generateTrendExplanation,
} from '@/lib/spendingAnalyser';
import { getCurrentMonthPeriod, getPreviousPeriod } from '@/utils/dateUtils';
import { Category } from '@/models/category';

export const dynamic = 'force-dynamic';

/**
 * GET /api/analysis
 * Detects spending anomalies and increasing category trends for the current period.
 */
export async function GET() {
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

    // Get current and previous period
    const currentPeriod = getCurrentMonthPeriod();
    const previousPeriod = getPreviousPeriod(currentPeriod.start, 'monthly');

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

    // Query all transactions for anomaly baseline (all user expenses)
    const { data: allTransactions, error: allError } = await supabase
      .from('transactions')
      .select('amount, category')
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
      }))
    );

    // Aggregate spending by category for current period
    const currentCategorySpending = aggregateByCategory(currentTransactions ?? []);
    // Aggregate spending by category for previous period
    const previousCategorySpending = aggregateByCategory(previousTransactions ?? []);

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
        hasPatterns: false,
        message: 'No unusual spending patterns found',
      });
    }

    return NextResponse.json({
      anomalies: anomaliesWithExplanation,
      trends: trendsWithExplanation,
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
