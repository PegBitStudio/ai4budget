import { Category } from '@/models/category';
import { SpendingAlert } from '@/models/alert';
import { formatCurrency } from '@/utils/formatters';

export interface AlertCheckParams {
  category: Category;
  categoryTotalSpent: number;
  budgetedAmount: number | null;
  existingAlerts: { category: Category; type: 'warning' | 'exceeded'; period_start: string }[];
  periodStart: string;
}

export interface NewAlert {
  category: Category;
  type: 'warning' | 'exceeded';
  amount_spent: number;
  budgeted_amount: number;
  period_start: string;
}

/**
 * Check whether new alerts should be generated after a transaction is stored.
 * Pure business logic — no database calls.
 */
export function checkAlerts(params: AlertCheckParams): NewAlert[] {
  const { category, categoryTotalSpent, budgetedAmount, existingAlerts, periodStart } = params;

  // No budget exists for current period — no alerts
  if (budgetedAmount === null) {
    return [];
  }

  const alerts: NewAlert[] = [];

  const hasExistingWarning = existingAlerts.some(
    (a) => a.category === category && a.type === 'warning' && a.period_start === periodStart
  );

  const hasExistingExceeded = existingAlerts.some(
    (a) => a.category === category && a.type === 'exceeded' && a.period_start === periodStart
  );

  // Check warning threshold (80%)
  if (categoryTotalSpent >= budgetedAmount * 0.8 && !hasExistingWarning) {
    alerts.push({
      category,
      type: 'warning',
      amount_spent: categoryTotalSpent,
      budgeted_amount: budgetedAmount,
      period_start: periodStart,
    });
  }

  // Check exceeded threshold (>100%)
  if (categoryTotalSpent > budgetedAmount && !hasExistingExceeded) {
    alerts.push({
      category,
      type: 'exceeded',
      amount_spent: categoryTotalSpent,
      budgeted_amount: budgetedAmount,
      period_start: periodStart,
    });
  }

  return alerts;
}

/**
 * Filter and sort alerts for a given period.
 * Returns alerts sorted by type ('exceeded' first, then 'warning'), then by created_at desc.
 */
export function getActiveAlerts(alerts: SpendingAlert[], periodStart: string): SpendingAlert[] {
  const filtered = alerts.filter((a) => a.period_start === periodStart);

  return filtered.sort((a, b) => {
    // 'exceeded' comes before 'warning'
    if (a.type !== b.type) {
      return a.type === 'exceeded' ? -1 : 1;
    }
    // Within same type, sort by created_at descending
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

/**
 * Format an alert into a human-readable message.
 */
export function formatAlertMessage(alert: {
  category: Category;
  type: 'warning' | 'exceeded';
  amount_spent: number;
  budgeted_amount: number;
}): string {
  const { category, type, amount_spent, budgeted_amount } = alert;

  if (type === 'warning') {
    const remaining = budgeted_amount - amount_spent;
    return `⚠️ ${category}: You've spent ${formatCurrency(amount_spent)} of your ${formatCurrency(budgeted_amount)} budget (80% reached). ${formatCurrency(remaining)} left.`;
  }

  // exceeded
  const overage = amount_spent - budgeted_amount;
  return `🚫 ${category}: You've exceeded your ${formatCurrency(budgeted_amount)} budget by ${formatCurrency(overage)}. Spent ${formatCurrency(amount_spent)} total.`;
}

/**
 * An alert derived from the current state of the budget rather than read back
 * from a snapshot written at insert time.
 */
export interface DerivedAlert {
  id: string;
  category: Category;
  type: 'warning' | 'exceeded';
  amount_spent: number;
  budgeted_amount: number;
  period_start: string;
  percentage: number;
}

/** Spending must reach this share of an allocation before we warn. */
export const WARNING_THRESHOLD = 0.8;

/**
 * Derives the live alert list by comparing this period's actual spending
 * against the current budget allocations.
 *
 * Unlike the stored alerts, this always reflects the present state: it appears
 * as soon as a budget is created for already-logged spending, updates as more
 * is spent, and disappears if the allocation is raised.
 *
 * Pure business logic — no database calls.
 */
export function deriveAlerts(
  allocations: { category: Category; amount: number }[],
  actualSpending: { category: Category; total: number }[],
  periodStart: string
): DerivedAlert[] {
  const alerts: DerivedAlert[] = [];

  for (const allocation of allocations) {
    if (allocation.amount <= 0) {
      continue;
    }

    const spent =
      actualSpending.find((s) => s.category === allocation.category)?.total ?? 0;
    const percentage = (spent / allocation.amount) * 100;

    if (spent <= allocation.amount * WARNING_THRESHOLD) {
      continue;
    }

    alerts.push({
      id: `${allocation.category}-${periodStart}`,
      category: allocation.category,
      type: spent > allocation.amount ? 'exceeded' : 'warning',
      amount_spent: spent,
      budgeted_amount: allocation.amount,
      period_start: periodStart,
      percentage,
    });
  }

  // Worst first: exceeded before warning, then by how far past the line.
  return alerts.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'exceeded' ? -1 : 1;
    }
    return b.percentage - a.percentage;
  });
}
