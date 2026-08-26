import { Category } from '@/models/category';
import { formatCurrency } from '@/utils/formatters';

/**
 * A month, written out.
 *
 * Reports here are compositions of figures the engines already produce, not a
 * new source of truth — every number in one can be found on a screen elsewhere
 * in the product, and if it could not, the report would be inventing something.
 *
 * The build is pure and takes the transactions already loaded by the caller, so
 * a report can be assembled, tested and rendered without touching a database.
 */

export interface ReportTransaction {
  amount: number;
  type: 'income' | 'expense';
  category: string;
  date: string;
  description: string;
}

export interface ReportLine {
  label: string;
  value: number;
  /** Share of the section's total, 0–100. Absent where a share is meaningless. */
  share?: number;
}

export interface ReportSection {
  heading: string;
  lines: ReportLine[];
  total?: number;
}

export interface Report {
  title: string;
  periodLabel: string;
  /** One sentence that says what the month did, before any table. */
  headline: string;
  sections: ReportSection[];
  /** Figures with no obvious home in a section, shown as a strip. */
  summary: { label: string; value: string }[];
}

export type ReportKind =
  | 'monthly-summary'
  | 'spending-by-category'
  | 'income'
  | 'cash-flow'
  | 'budget-performance';

export const REPORT_KINDS: {
  kind: ReportKind;
  name: string;
  description: string;
}[] = [
  {
    kind: 'monthly-summary',
    name: 'Monthly summary',
    description: 'Everything in one page: earned, spent, and what is left.',
  },
  {
    kind: 'spending-by-category',
    name: 'Spending by category',
    description: 'Where the money went, ranked, with each category’s share.',
  },
  {
    kind: 'income',
    name: 'Income',
    description: 'What came in, and from where.',
  },
  {
    kind: 'cash-flow',
    name: 'Cash flow',
    description: 'Money in against money out, week by week.',
  },
  {
    kind: 'budget-performance',
    name: 'Budget performance',
    description: 'Planned against actual, with the variance on each line.',
  },
];

export interface BuildReportInput {
  kind: ReportKind;
  transactions: ReportTransaction[];
  allocations: { category: Category; amount: number }[];
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  /** Explicit, because this runs on a server shared by every account. */
  symbol?: string;
}

export function buildReport(input: BuildReportInput): Report {
  const { kind, transactions, allocations, periodLabel, symbol } = input;
  const money = (value: number) => formatCurrency(value, symbol);

  const income = sum(transactions.filter((t) => t.type === 'income'));
  const spending = sum(transactions.filter((t) => t.type === 'expense'));
  const net = round2(income - spending);

  const base = {
    periodLabel,
    summary: [
      { label: 'Money in', value: money(income) },
      { label: 'Money out', value: money(spending) },
      {
        label: net >= 0 ? 'Left over' : 'Short by',
        value: money(Math.abs(net)),
      },
    ],
  };

  switch (kind) {
    case 'spending-by-category':
      return {
        ...base,
        title: 'Spending by category',
        headline: headlineForSpending(spending, transactions, symbol),
        sections: [
          {
            heading: 'Every category, largest first',
            lines: byCategory(transactions.filter((t) => t.type === 'expense')),
            total: spending,
          },
        ],
      };

    case 'income':
      return {
        ...base,
        title: 'Income',
        headline:
          income > 0
            ? `${money(income)} came in across ${countOf(transactions.filter((t) => t.type === 'income'))}.`
            : 'No income was recorded for this period.',
        sections: [
          {
            heading: 'Where it came from',
            lines: byDescription(transactions.filter((t) => t.type === 'income')),
            total: income,
          },
        ],
      };

    case 'cash-flow':
      return {
        ...base,
        title: 'Cash flow',
        headline: headlineForNet(net, income, spending, symbol),
        sections: [
          {
            heading: 'Week by week',
            lines: byWeek(transactions, input.periodStart),
          },
        ],
      };

    case 'budget-performance':
      return {
        ...base,
        title: 'Budget performance',
        headline: headlineForBudget(allocations, transactions, symbol),
        sections: [
          {
            heading: 'Planned against actual',
            lines: budgetVariance(allocations, transactions),
          },
        ],
      };

    default:
      return {
        ...base,
        title: 'Monthly summary',
        headline: headlineForNet(net, income, spending, symbol),
        sections: [
          {
            heading: 'Spending by category',
            lines: byCategory(
              transactions.filter((t) => t.type === 'expense')
            ).slice(0, 6),
            total: spending,
          },
          {
            heading: 'Income',
            lines: byDescription(transactions.filter((t) => t.type === 'income')),
            total: income,
          },
        ],
      };
  }
}

// --- Sections --------------------------------------------------------------

function byCategory(expenses: ReportTransaction[]): ReportLine[] {
  const totals = new Map<string, number>();
  for (const t of expenses) {
    totals.set(t.category, (totals.get(t.category) ?? 0) + t.amount);
  }

  const total = sum(expenses);

  return Array.from(totals.entries())
    .map(([label, value]) => ({
      label,
      value: round2(value),
      share: total > 0 ? round2((value / total) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

function byDescription(rows: ReportTransaction[]): ReportLine[] {
  const totals = new Map<string, number>();
  for (const t of rows) {
    totals.set(t.description, (totals.get(t.description) ?? 0) + t.amount);
  }

  const total = sum(rows);

  return Array.from(totals.entries())
    .map(([label, value]) => ({
      label,
      value: round2(value),
      share: total > 0 ? round2((value / total) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Weeks counted from the period's first day rather than from Monday: a report
 * about a calendar month should not open with a partial week belonging to the
 * month before it.
 */
function byWeek(rows: ReportTransaction[], periodStart: string): ReportLine[] {
  const start = parseDate(periodStart);
  const weeks = new Map<number, { in: number; out: number }>();

  for (const t of rows) {
    const offset = Math.floor(daysBetween(start, parseDate(t.date)) / 7);
    if (offset < 0) continue;
    const bucket = weeks.get(offset) ?? { in: 0, out: 0 };
    if (t.type === 'income') bucket.in += t.amount;
    else bucket.out += t.amount;
    weeks.set(offset, bucket);
  }

  return Array.from(weeks.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([offset, bucket]) => ({
      label: `Week ${offset + 1}`,
      value: round2(bucket.in - bucket.out),
    }));
}

function budgetVariance(
  allocations: { category: Category; amount: number }[],
  transactions: ReportTransaction[]
): ReportLine[] {
  const spent = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== 'expense') continue;
    spent.set(t.category, (spent.get(t.category) ?? 0) + t.amount);
  }

  return allocations
    .map((allocation) => {
      const actual = spent.get(allocation.category) ?? 0;
      // Positive means over plan, which is the direction that matters.
      return {
        label: allocation.category,
        value: round2(actual - allocation.amount),
        share:
          allocation.amount > 0
            ? round2((actual / allocation.amount) * 100)
            : undefined,
      };
    })
    .sort((a, b) => b.value - a.value);
}

// --- Headlines -------------------------------------------------------------

function headlineForNet(net: number, income: number, spending: number, symbol?: string): string {
  const money = (v: number) => formatCurrency(v, symbol);
  if (income === 0 && spending === 0) {
    return 'Nothing was recorded for this period.';
  }
  if (net < 0) {
    return `You spent ${money(Math.abs(net))} more than you earned — ${money(spending)} out against ${money(income)} in.`;
  }
  if (net === 0) {
    return `You spent exactly what you earned: ${money(income)}.`;
  }
  const rate = income > 0 ? Math.round((net / income) * 100) : 0;
  return `You kept ${money(net)} of ${money(income)} — a saving rate of ${rate}%.`;
}

function headlineForSpending(
  spending: number,
  transactions: ReportTransaction[],
  symbol?: string
): string {
  const money = (v: number) => formatCurrency(v, symbol);
  const expenses = transactions.filter((t) => t.type === 'expense');
  if (expenses.length === 0) {
    return 'No spending was recorded for this period.';
  }
  const ranked = byCategory(expenses);
  const top = ranked[0];
  return `${money(spending)} across ${countOf(expenses)}. ${top.label} was the largest at ${money(top.value)}, ${Math.round(top.share ?? 0)}% of everything you spent.`;
}

function headlineForBudget(
  allocations: { category: Category; amount: number }[],
  transactions: ReportTransaction[],
  symbol?: string
): string {
  const money = (v: number) => formatCurrency(v, symbol);
  if (allocations.length === 0) {
    return 'No budget was set for this period, so there is nothing to compare against.';
  }
  const variance = budgetVariance(allocations, transactions);
  const over = variance.filter((line) => line.value > 0);

  if (over.length === 0) {
    return `Every one of your ${allocations.length} categories finished inside its plan.`;
  }

  const worst = over[0];
  return `${over.length} of ${allocations.length} categories finished over plan. ${worst.label} was the furthest out, at ${money(worst.value)} over.`;
}

// --- Helpers ---------------------------------------------------------------

function countOf(rows: unknown[]): string {
  return `${rows.length} ${rows.length === 1 ? 'transaction' : 'transactions'}`;
}

function sum(rows: { amount: number }[]): number {
  return round2(rows.reduce((total, row) => total + row.amount, 0));
}

function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
