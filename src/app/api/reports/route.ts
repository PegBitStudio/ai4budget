import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildReport, REPORT_KINDS, type ReportKind } from '@/lib/reportBuilder';
import { Category } from '@/models/category';
import { getUserCurrency } from '@/lib/userCurrency';

export const dynamic = 'force-dynamic';

/**
 * GET /api/reports?kind=…&month=YYYY-MM
 *
 * Composes a report from the period's transactions and budget. Nothing is
 * stored: a report is a view of the same rows every other screen reads, so
 * saving one would only create a second version of the truth that could drift
 * from the first.
 */
export async function GET(request: NextRequest) {
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
    const { searchParams } = new URL(request.url);

    const requestedKind = searchParams.get('kind');
    const kind: ReportKind = REPORT_KINDS.some((r) => r.kind === requestedKind)
      ? (requestedKind as ReportKind)
      : 'monthly-summary';

    const month = parseMonth(searchParams.get('month'));
    const periodStart = `${month.year}-${pad(month.month)}-01`;
    const lastDay = new Date(month.year, month.month, 0).getDate();
    const periodEnd = `${month.year}-${pad(month.month)}-${pad(lastDay)}`;

    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('amount, type, category, date, description')
      .gte('date', periodStart)
      .lte('date', periodEnd)
      .order('date', { ascending: true });

    if (txError) {
      return NextResponse.json(
        { error: 'Failed to fetch transactions', details: txError.message },
        { status: 500 }
      );
    }

    const { data: budgets } = await supabase
      .from('budgets')
      .select('allocations')
      .lte('period_start', periodEnd)
      .gte('period_end', periodStart)
      .order('created_at', { ascending: false })
      .limit(1);

    const allocations = budgets?.length
      ? (budgets[0].allocations as Array<{ category: string; amount: number }>).map(
          (a) => ({ category: a.category as Category, amount: a.amount })
        )
      : [];

    const report = buildReport({
      kind,
      transactions: (transactions ?? []).map((t) => ({
        amount: t.amount,
        type: t.type as 'income' | 'expense',
        category: t.category,
        date: t.date,
        description: t.description,
      })),
      allocations,
      periodStart,
      periodEnd,
      symbol: currency.symbol,
      periodLabel: new Date(month.year, month.month - 1, 1).toLocaleDateString(
        'en-NG',
        { month: 'long', year: 'numeric' }
      ),
    });

    return NextResponse.json({ report }, { status: 200 });
  } catch (error) {
    console.error('[GET /api/reports] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** Falls back to the current month for anything unparseable. */
function parseMonth(raw: string | null): { year: number; month: number } {
  const now = new Date();
  const fallback = { year: now.getFullYear(), month: now.getMonth() + 1 };

  if (!raw || !/^\d{4}-\d{2}$/.test(raw)) return fallback;

  const [year, month] = raw.split('-').map(Number);
  if (month < 1 || month > 12 || year < 2000 || year > 2100) return fallback;

  return { year, month };
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
