import { Category } from '@/models/category';
import { SpendingAlert } from '@/models/alert';

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
    return `⚠️ ${category}: You've spent $${amount_spent.toFixed(2)} of your $${budgeted_amount.toFixed(2)} budget (80% reached). $${remaining.toFixed(2)} left.`;
  }

  // exceeded
  const overage = amount_spent - budgeted_amount;
  return `🚫 ${category}: You've exceeded your $${budgeted_amount.toFixed(2)} budget by $${overage.toFixed(2)}. Spent $${amount_spent.toFixed(2)} total.`;
}
