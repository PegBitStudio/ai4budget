import { Category } from '@/models/category';
import { formatCurrency } from '@/utils/formatters';
import type { DerivedAlert } from './alertEngine';
import type { CategoryForecast } from './forecastEngine';
import { describeForecast } from './forecastEngine';
import type { SpendingAnomaly, CategoryTrend } from './spendingAnalyser';

/**
 * Everything the product noticed without being asked.
 *
 * The engines each answer their own question — what went over, what is heading
 * over, what was unusual, what is creeping up — and this gathers the answers
 * into one ranked feed. That gathering is the point: signals scattered across
 * four screens are signals nobody sees, and a budgeting tool that only tells
 * you things while you happen to be looking at the right page is not really
 * telling you anything.
 *
 * Every id is derived from what the notification is *about* — category, period,
 * transaction — never from when it was generated. That is what lets read state
 * survive a refresh: the same overspend produces the same id every time, so
 * dismissing it sticks, while next month's version of it is a new id and comes
 * back.
 */

export type NotificationSeverity = 'critical' | 'warning' | 'info';

export type NotificationKind =
  | 'budget-exceeded'
  | 'budget-approaching'
  | 'budget-forecast'
  | 'unusual-spend'
  | 'category-rising';

export interface Notification {
  /** Stable across renders and reloads. Derived from the subject, never the clock. */
  id: string;
  kind: NotificationKind;
  severity: NotificationSeverity;
  title: string;
  body: string;
  /** Where to go to do something about it. */
  href: string;
  category?: Category;
}

export interface NotificationInput {
  alerts: DerivedAlert[];
  forecasts: CategoryForecast[];
  anomalies: SpendingAnomaly[];
  risingCategories: CategoryTrend[];
  periodStart: string;
  daysRemaining: number;
  /** Explicit, because this runs on a server shared by every account. */
  symbol?: string;
}

/** Ranked worst-first, so the top of the list is the thing most worth doing. */
const SEVERITY_RANK: Record<NotificationSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

/** Enough to be useful, few enough to still be read. */
export const MAX_NOTIFICATIONS = 8;

export function buildNotifications(input: NotificationInput): Notification[] {
  const { alerts, forecasts, anomalies, risingCategories, periodStart, daysRemaining, symbol } =
    input;
  const money = (value: number) => formatCurrency(value, symbol);

  const notifications: Notification[] = [];

  // 1. What has already gone over, and what is close to it.
  for (const alert of alerts) {
    const over = alert.amount_spent - alert.budgeted_amount;

    if (alert.type === 'exceeded') {
      notifications.push({
        id: `budget-exceeded:${alert.category}:${alert.period_start}`,
        kind: 'budget-exceeded',
        severity: 'critical',
        title: `${alert.category} is over budget`,
        body: `${money(alert.amount_spent)} spent against a ${money(alert.budgeted_amount)} plan — ${money(over)} over.`,
        href: '/budget',
        category: alert.category,
      });
    } else {
      notifications.push({
        id: `budget-approaching:${alert.category}:${alert.period_start}`,
        kind: 'budget-approaching',
        severity: 'warning',
        title: `${alert.category} is close to its limit`,
        body: `${money(alert.amount_spent)} of ${money(alert.budgeted_amount)} used — ${Math.round(alert.percentage)}% of the plan.`,
        href: '/budget',
        category: alert.category,
      });
    }
  }

  // 2. What is heading over but has not got there yet. This is the only signal
  //    that arrives while there is still time to act on it, so it outranks the
  //    backward-looking ones of the same severity by sitting above them here.
  for (const forecast of forecasts) {
    if (!forecast.usable || forecast.verdict !== 'will-exceed') {
      continue;
    }
    // Already covered by an exceeded alert — do not say it twice.
    if (alerts.some((a) => a.category === forecast.category && a.type === 'exceeded')) {
      continue;
    }

    notifications.push({
      id: `budget-forecast:${forecast.category}:${periodStart}`,
      kind: 'budget-forecast',
      severity: 'warning',
      title: `${forecast.category} is on course to go over`,
      body: describeForecast(forecast, daysRemaining, symbol),
      href: '/budget',
      category: forecast.category,
    });
  }

  // 3. Individual transactions well outside the usual shape of a category.
  for (const anomaly of anomalies) {
    notifications.push({
      id: `unusual-spend:${anomaly.transaction.id}`,
      kind: 'unusual-spend',
      severity: 'info',
      title: `Unusual ${anomaly.transaction.category} spend`,
      body: `${anomaly.transaction.description} at ${money(anomaly.transaction.amount)} — about ${anomaly.multiple.toFixed(1)}× your usual ${money(anomaly.categoryAverage)}.`,
      href: '/analysis',
      category: anomaly.transaction.category,
    });
  }

  // 4. Categories quietly getting heavier month on month.
  for (const trend of risingCategories) {
    notifications.push({
      id: `category-rising:${trend.category}:${periodStart}`,
      kind: 'category-rising',
      severity: 'info',
      title: `${trend.category} is rising`,
      body: `Up ${Math.round(trend.percentageChange)}% on last period — ${money(trend.previousAmount)} to ${money(trend.currentAmount)}.`,
      href: '/analysis',
      category: trend.category,
    });
  }

  const seen = new Set<string>();
  return notifications
    .filter((n) => {
      if (seen.has(n.id)) return false;
      seen.add(n.id);
      return true;
    })
    .sort((a, b) => {
      const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      if (bySeverity !== 0) return bySeverity;
      // Within a severity, the one you can still do something about comes first.
      const actionable = (n: Notification) => (n.kind === 'budget-forecast' ? 0 : 1);
      return actionable(a) - actionable(b);
    })
    .slice(0, MAX_NOTIFICATIONS);
}

/** How many of these the reader has not already dismissed. */
export function countUnread(
  notifications: Notification[],
  readIds: readonly string[]
): number {
  const read = new Set(readIds);
  return notifications.filter((n) => !read.has(n.id)).length;
}
