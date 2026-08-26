import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { deriveAlerts } from '@/lib/alertEngine';
import {
  forecastCategories,
  getPeriodProgress,
  describeForecast,
} from '@/lib/forecastEngine';
import { detectAnomalies, detectIncreasingCategories } from '@/lib/spendingAnalyser';
import { buildNotifications } from '@/lib/notifications';
import { getCurrentMonthPeriod } from '@/utils/dateUtils';
import { Category } from '@/models/category';
import { getUserCurrency } from '@/lib/userCurrency';

export const dynamic = 'force-dynamic';

/**
 * GET /api/notifications
 *
 * Everything the product noticed, in one place: what has gone over budget,
 * what is heading there, what was unusual, and what is quietly rising.
 *
 * Computed on read rather than written when a transaction lands. That costs a
 * few queries, but it means a notification reflects the budget and the spending
 * as they are right now — raise an allocation and the warning clears, add a
 * transaction and the forecast moves. Snapshots written at insert time go stale
 * the moment anything else changes, and stale money warnings are worse than
 * none.
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currency = await getUserCurrency();
    const period = getCurrentMonthPeriod();
    const today = localToday();
    const progress = getPeriodProgress(period.start, period.end, today);

    // This period's expenses, kept as individual rows: the forecast needs to
    // see the shape of the spending, not just its total.
    const { data: expenses } = await supabase
      .from('transactions')
      .select('id, amount, category, date, description')
      .eq('type', 'expense')
      .gte('date', period.start)
      .lte('date', period.end);

    const rows = expenses ?? [];
    // Supabase types the column as string; the classifier guarantees the value.
    const typedRows = rows.map((r) => ({ ...r, category: r.category as Category }));

    const amountsByCategory: Record<string, number[]> = {};
    const totals = new Map<string, number>();
    for (const row of rows) {
      (amountsByCategory[row.category] ??= []).push(row.amount);
      totals.set(row.category, (totals.get(row.category) ?? 0) + row.amount);
    }

    const currentTotals = Array.from(totals.entries()).map(([category, total]) => ({
      category: category as Category,
      total,
    }));

    // The budget covering this period, if there is one.
    const { data: budgets } = await supabase
      .from('budgets')
      .select('allocations')
      .lte('period_start', period.end)
      .gte('period_end', period.start)
      .order('created_at', { ascending: false })
      .limit(1);

    const allocations = budgets?.length
      ? (budgets[0].allocations as Array<{ category: string; amount: number }>).map(
          (a) => ({ category: a.category as Category, amount: a.amount })
        )
      : [];

    const alerts = allocations.length
      ? deriveAlerts(allocations, currentTotals, period.start)
      : [];

    const forecasts = allocations.length
      ? forecastCategories({
          allocations,
          transactionsByCategory: amountsByCategory,
          periodStart: period.start,
          periodEnd: period.end,
          today,
        })
      : [];

    // Anomalies are judged against the whole history, not just this period —
    // one month is not enough to know what "usual" looks like.
    const { data: history } = await supabase
      .from('transactions')
      .select('amount, category, date, description')
      .eq('type', 'expense')
      .lt('date', period.start);

    const anomalies =
      rows.length && history?.length
        ? detectAnomalies(
            typedRows,
            history.map((h) => ({ ...h, category: h.category as Category }))
          ).slice(0, 3)
        : [];

    // Last period, for the rising-category comparison.
    const previous = previousMonthPeriod(period.start);
    const { data: previousExpenses } = await supabase
      .from('transactions')
      .select('amount, category')
      .eq('type', 'expense')
      .gte('date', previous.start)
      .lte('date', previous.end);

    const previousTotals = new Map<string, number>();
    for (const row of previousExpenses ?? []) {
      previousTotals.set(
        row.category,
        (previousTotals.get(row.category) ?? 0) + row.amount
      );
    }

    const risingCategories = previousTotals.size
      ? detectIncreasingCategories(
          currentTotals,
          Array.from(previousTotals.entries()).map(([category, total]) => ({
            category: category as Category,
            total,
          }))
        ).slice(0, 3)
      : [];

    const notifications = buildNotifications({
      alerts,
      forecasts,
      anomalies,
      risingCategories,
      periodStart: period.start,
      daysRemaining: progress.daysRemaining,
      symbol: currency.symbol,
    });

    return NextResponse.json(
      {
        notifications,
        daysRemaining: progress.daysRemaining,
        // The budget page wants every category heading somewhere, including
        // the ones already over — the bell suppresses those to avoid saying
        // the same thing twice, but on that page the projection is the point.
        forecasts: forecasts
          .filter((f) => f.usable && f.verdict !== 'on-track')
          .map((f) => ({ ...f, sentence: describeForecast(f, progress.daysRemaining, currency.symbol) })),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[GET /api/notifications] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/** Built from local parts: in WAT, toISOString() would report yesterday. */
function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function previousMonthPeriod(periodStart: string): { start: string; end: string } {
  const [year, month] = periodStart.split('-').map(Number);
  const start = new Date(year, month - 2, 1);
  const end = new Date(year, month - 1, 0);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start: fmt(start), end: fmt(end) };
}
