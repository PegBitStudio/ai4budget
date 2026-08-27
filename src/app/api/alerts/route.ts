import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { deriveAlerts } from '@/lib/alertEngine';
import { getCurrentMonthPeriod } from '@/utils/dateUtils';
import { Category } from '@/models/category';

export const dynamic = 'force-dynamic';

/**
 * GET /api/alerts
 * Returns the user's live budget alerts for the current period.
 *
 * Alerts are computed from current spending against the current budget on every
 * read, rather than read back from snapshots written at transaction-insert
 * time. That means they appear for spending logged before the budget existed,
 * stay accurate as more is spent, and clear when an allocation is raised.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const period = getCurrentMonthPeriod();

    // The budget covering the current period, most recent first.
    const { data: budgets, error: budgetError } = await supabase
      .from('budgets')
      .select('allocations')
      .lte('period_start', period.end)
      .gte('period_end', period.start)
      .order('created_at', { ascending: false })
      .limit(1);

    if (budgetError) {
      console.error('[GET /api/alerts] Failed to fetch budget:', budgetError.message);
      return NextResponse.json(
        { error: 'Failed to fetch budget' },
        { status: 500 }
      );
    }

    // No budget for this period means there is nothing to be over.
    if (!budgets || budgets.length === 0) {
      return NextResponse.json({ alerts: [] }, { status: 200 });
    }

    const allocations = (
      budgets[0].allocations as Array<{ category: string; amount: number }>
    ).map((a) => ({ category: a.category as Category, amount: a.amount }));

    const { data: expenses, error: expenseError } = await supabase
      .from('transactions')
      .select('amount, category')
      .eq('type', 'expense')
      .gte('date', period.start)
      .lte('date', period.end);

    if (expenseError) {
      console.error('[GET /api/alerts] Failed to fetch spending:', expenseError.message);
      return NextResponse.json(
        { error: 'Failed to fetch spending' },
        { status: 500 }
      );
    }

    // Total this period's spending per category.
    const totals = new Map<string, number>();
    for (const expense of expenses ?? []) {
      totals.set(
        expense.category,
        (totals.get(expense.category) ?? 0) + expense.amount
      );
    }

    const actualSpending = Array.from(totals.entries()).map(
      ([category, total]) => ({ category: category as Category, total })
    );

    const alerts = deriveAlerts(allocations, actualSpending, period.start);

    return NextResponse.json({ alerts }, { status: 200 });
  } catch (error) {
    console.error('[GET /api/alerts] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
