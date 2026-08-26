import { Category } from '@/models/category';
import { formatCurrency } from '@/utils/formatters';

/**
 * Where this month ends up, if nothing changes.
 *
 * Every other engine in this product looks backwards: what you spent, what
 * crept up, what went over. This one is the only forward-looking piece, and it
 * is what turns a budget alert from a receipt into a warning — being told on
 * the 12th that Dining will run ₦18,000 over is worth something, being told on
 * the 30th is not.
 *
 * It is deliberately conservative about when it will speak. A run rate is a
 * lie when the spending is lumpy: rent paid on the 1st projects to thirty times
 * rent, and one big-ticket purchase makes a category look like a habit. So a
 * projection is only offered when the period is far enough along AND the
 * spending looks like a rate rather than an event. Everything else is returned
 * with low confidence and never shown as a prediction.
 *
 * Nothing here is advice, and nothing here is a promise — the wording
 * throughout is conditional, because the whole point is that the user can
 * change the outcome.
 */

/** Below this share of the period elapsed, a run rate is noise. */
const MIN_ELAPSED_SHARE = 0.25;

/** One transaction is an event; a rate needs at least a few. */
const MIN_TRANSACTIONS = 3;

/**
 * If one purchase dominates a category, the rest of the period will not look
 * like the part we have seen.
 */
const DOMINANT_TRANSACTION_SHARE = 0.6;

/** Ignore projections that land within this much of the budget either way. */
const CLOSE_BAND = 0.02;

/** "Close to the line" starts here. */
const NEAR_LIMIT_SHARE = 0.9;

export type ForecastVerdict =
  | 'exceeded'
  | 'will-exceed'
  | 'close'
  | 'on-track';

export interface CategoryForecast {
  category: Category;
  budgeted: number;
  spentSoFar: number;
  /** Projected total by the end of the period. Equals spentSoFar when unusable. */
  projected: number;
  /** How far past the budget the projection lands. Zero when it does not. */
  projectedOverspend: number;
  verdict: ForecastVerdict;
  /** Whether the projection is worth showing at all. */
  usable: boolean;
  /** Why it is not, when it is not — surfaced in tests and useful in logs. */
  reason?: 'too-early' | 'too-few-transactions' | 'one-off-dominates' | 'no-budget';
}

export interface PeriodProgress {
  elapsedDays: number;
  totalDays: number;
  daysRemaining: number;
}

/**
 * How far through the period we are, counting the current day as elapsed —
 * spending done today has already happened.
 */
export function getPeriodProgress(
  periodStart: string,
  periodEnd: string,
  today: string
): PeriodProgress {
  const start = parseDate(periodStart);
  const end = parseDate(periodEnd);
  const now = parseDate(today);

  const totalDays = daysBetween(start, end) + 1;
  const rawElapsed = daysBetween(start, now) + 1;

  // Clamp: a date outside the period should not produce a negative rate or a
  // projection beyond the period's end.
  const elapsedDays = Math.min(Math.max(rawElapsed, 0), totalDays);

  return {
    elapsedDays,
    totalDays,
    daysRemaining: Math.max(totalDays - elapsedDays, 0),
  };
}

export interface ForecastInput {
  allocations: { category: Category; amount: number }[];
  /** Individual expense amounts per category, not just the total. */
  transactionsByCategory: Record<string, number[]>;
  periodStart: string;
  periodEnd: string;
  today: string;
}

export function forecastCategories(input: ForecastInput): CategoryForecast[] {
  const { allocations, transactionsByCategory, periodStart, periodEnd, today } =
    input;

  const { elapsedDays, totalDays } = getPeriodProgress(
    periodStart,
    periodEnd,
    today
  );

  const forecasts = allocations.map((allocation) =>
    forecastOne(
      allocation,
      transactionsByCategory[allocation.category] ?? [],
      elapsedDays,
      totalDays
    )
  );

  // Worst first: what has already gone, then what is about to.
  return forecasts.sort((a, b) => {
    const rank = (f: CategoryForecast) =>
      f.verdict === 'exceeded' ? 0 : f.verdict === 'will-exceed' ? 1 : f.verdict === 'close' ? 2 : 3;
    const byRank = rank(a) - rank(b);
    return byRank !== 0 ? byRank : b.projectedOverspend - a.projectedOverspend;
  });
}

function forecastOne(
  allocation: { category: Category; amount: number },
  amounts: number[],
  elapsedDays: number,
  totalDays: number
): CategoryForecast {
  const spentSoFar = round2(amounts.reduce((sum, a) => sum + a, 0));
  const budgeted = allocation.amount;

  const base: CategoryForecast = {
    category: allocation.category,
    budgeted,
    spentSoFar,
    projected: spentSoFar,
    projectedOverspend: 0,
    verdict: 'on-track',
    usable: false,
  };

  if (budgeted <= 0) {
    return { ...base, reason: 'no-budget' };
  }

  // Whether a run rate can be read at all, decided before anything is said
  // about the budget. A category that has already gone over still benefits
  // from knowing where it lands — "already ₦280,500 over, and heading for
  // ₦358,000" is a different decision from "already over".
  const largest = amounts.length > 0 ? Math.max(...amounts) : 0;

  let reason: CategoryForecast['reason'];
  if (elapsedDays <= 0 || elapsedDays / totalDays < MIN_ELAPSED_SHARE) {
    reason = 'too-early';
  } else if (amounts.length < MIN_TRANSACTIONS) {
    reason = 'too-few-transactions';
  } else if (spentSoFar > 0 && largest / spentSoFar > DOMINANT_TRANSACTION_SHARE) {
    // One purchase carrying the category means the rate is an illusion.
    reason = 'one-off-dominates';
  }

  const canProject = reason === undefined;
  const projected = canProject
    ? round2((spentSoFar / elapsedDays) * totalDays)
    : spentSoFar;

  // Already over. That part is a fact, not a projection, and the overspend
  // reported is the one that has actually happened.
  if (spentSoFar > budgeted) {
    return {
      ...base,
      projected,
      verdict: 'exceeded',
      projectedOverspend: round2(spentSoFar - budgeted),
      usable: true,
      reason,
    };
  }

  if (!canProject) {
    return { ...base, reason };
  }

  const overspend = round2(Math.max(projected - budgeted, 0));

  let verdict: ForecastVerdict = 'on-track';
  if (projected > budgeted * (1 + CLOSE_BAND)) {
    verdict = 'will-exceed';
  } else if (projected > budgeted * NEAR_LIMIT_SHARE) {
    verdict = 'close';
  }

  return {
    ...base,
    projected,
    projectedOverspend: overspend,
    verdict,
    usable: true,
  };
}

/**
 * One sentence, in the conditional. It says what happens if nothing changes,
 * which is the only claim a run rate can honestly support.
 */
export function describeForecast(
  forecast: CategoryForecast,
  daysRemaining: number,
  // Passed rather than defaulted: this runs on the server, where one process
  // serves every account and a shared symbol would be another user's money.
  symbol?: string
): string {
  const money = (value: number) => formatCurrency(value, symbol);
  const { category, projectedOverspend, budgeted, spentSoFar, projected } =
    forecast;

  switch (forecast.verdict) {
    case 'exceeded': {
      const already = `${category} is already ${money(projectedOverspend)} past its ${money(budgeted)} plan.`;
      // Only add the projection when it says something the fact does not.
      return projected > spentSoFar
        ? `${already} At this rate it finishes around ${money(projected)}.`
        : already;
    }
    case 'will-exceed':
      return `At this rate ${category} finishes the period around ${money(projected)} — about ${money(projectedOverspend)} over plan, with ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} still to go.`;
    case 'close':
      return `${category} is on course to finish close to its limit: about ${money(projected)} against a ${money(budgeted)} plan.`;
    default:
      return `${category} is tracking within plan — ${money(spentSoFar)} of ${money(budgeted)} so far.`;
  }
}

// --- Helpers ---------------------------------------------------------------

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
