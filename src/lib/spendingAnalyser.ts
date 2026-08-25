/**
 * Spending comparison and pattern detection logic.
 * Pure business logic — no database calls.
 */

import { Category } from '@/models/category';
import { BudgetComparison, CategoryAllocation } from '@/models/budget';
import { formatCurrency } from '@/utils/formatters';

export interface SpendingAnomaly {
  transaction: {
    id: string;
    amount: number;
    category: Category;
    date: string;
    description: string;
  };
  /** The typical spend for this category — a median, not a mean. */
  categoryAverage: number;
  multiple: number;
}

/** A transaction from the user's history, used to build the baseline. */
export interface HistoricTransaction {
  amount: number;
  category: Category;
  description: string;
  date: string;
}

export interface CategoryTrend {
  category: Category;
  previousAmount: number;
  currentAmount: number;
  percentageChange: number;
}

/**
 * Compares budget allocations against actual spending for each category.
 *
 * Status classification:
 * - 'over': actual > budgeted
 * - 'on-track': actual >= budgeted × 0.9 AND actual <= budgeted
 * - 'under': actual < budgeted × 0.9
 */
export function getComparison(
  budgetAllocations: CategoryAllocation[],
  actualSpending: { category: Category; total: number }[]
): BudgetComparison[] {
  return budgetAllocations.map((allocation) => {
    const spending = actualSpending.find(
      (s) => s.category === allocation.category
    );
    const actual = spending?.total ?? 0;
    const budgeted = allocation.amount;
    const variance = actual - budgeted;

    let status: 'under' | 'on-track' | 'over';
    if (actual > budgeted) {
      status = 'over';
    } else if (actual >= budgeted * 0.9) {
      status = 'on-track';
    } else {
      status = 'under';
    }

    return {
      category: allocation.category,
      budgeted,
      actual,
      variance,
      status,
    };
  });
}

/** A transaction must exceed this multiple of the category median to be unusual. */
const ANOMALY_MULTIPLE = 2;

/** Below this many transactions a category has no meaningful baseline. */
const MIN_CATEGORY_HISTORY = 3;

/** Appearing in this many distinct months makes a charge recurring, not unusual. */
const RECURRING_MONTHS = 2;

/**
 * The middle value of a list. Used instead of the mean because one large
 * purchase drags a mean upward and then hides behind it — a ₦285,000 phone in
 * a category of ₦15,000 purchases pulls the average high enough that the
 * phone itself stops looking unusual.
 */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/** Normalises a description for comparison: lowercase, alphanumeric only. */
function merchantKey(description: string): string {
  return description.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Descriptions that appear in two or more distinct months. A gym membership
 * charged the same amount every month is a commitment, not a surprise, and
 * flagging it teaches the user to distrust the whole feature.
 */
function findRecurringMerchants(history: HistoricTransaction[]): Set<string> {
  const monthsSeen = new Map<string, Set<string>>();

  for (const t of history) {
    const key = merchantKey(t.description);
    if (!key) continue;
    const months = monthsSeen.get(key) ?? new Set<string>();
    months.add(t.date.slice(0, 7)); // YYYY-MM
    monthsSeen.set(key, months);
  }

  const recurring = new Set<string>();
  for (const [key, months] of Array.from(monthsSeen.entries())) {
    if (months.size >= RECURRING_MONTHS) {
      recurring.add(key);
    }
  }
  return recurring;
}

/**
 * Detects genuinely unusual transactions in the current period.
 *
 * A transaction is flagged when:
 * - Its description is not a recurring charge, and
 * - Its category has at least 3 transactions to compare against, and
 * - Its amount is more than twice the category median.
 *
 * Worst offender first, so the biggest surprise leads.
 */
export function detectAnomalies(
  transactions: {
    amount: number;
    category: Category;
    date: string;
    description: string;
    id: string;
  }[],
  allTransactions: HistoricTransaction[]
): SpendingAnomaly[] {
  const recurring = findRecurringMerchants(allTransactions);
  const anomalies: SpendingAnomaly[] = [];

  for (const tx of transactions) {
    if (recurring.has(merchantKey(tx.description))) {
      continue;
    }

    const categoryAmounts = allTransactions
      .filter((t) => t.category === tx.category)
      .map((t) => t.amount);

    if (categoryAmounts.length < MIN_CATEGORY_HISTORY) {
      continue;
    }

    const categoryAverage = median(categoryAmounts);
    if (categoryAverage <= 0) {
      continue;
    }

    if (tx.amount > ANOMALY_MULTIPLE * categoryAverage) {
      anomalies.push({
        transaction: {
          id: tx.id,
          amount: tx.amount,
          category: tx.category,
          date: tx.date,
          description: tx.description,
        },
        categoryAverage,
        multiple: tx.amount / categoryAverage,
      });
    }
  }

  return anomalies.sort((a, b) => b.multiple - a.multiple);
}

/**
 * Detects categories where spending increased by more than 20%
 * compared to the previous period.
 */
export function detectIncreasingCategories(
  currentPeriodSpending: { category: Category; total: number }[],
  previousPeriodSpending: { category: Category; total: number }[]
): CategoryTrend[] {
  const trends: CategoryTrend[] = [];

  for (const current of currentPeriodSpending) {
    const previous = previousPeriodSpending.find(
      (p) => p.category === current.category
    );

    if (!previous || previous.total === 0) {
      continue;
    }

    const percentageChange =
      ((current.total - previous.total) / previous.total) * 100;

    if (percentageChange > 20) {
      trends.push({
        category: current.category,
        previousAmount: previous.total,
        currentAmount: current.total,
        percentageChange,
      });
    }
  }

  return trends;
}

/**
 * Generates a plain-language explanation for a spending anomaly.
 */
export function generateExplanation(anomaly: SpendingAnomaly): string {
  return `${anomaly.multiple.toFixed(1)}× your usual ${anomaly.transaction.category} spend of ${formatCurrency(anomaly.categoryAverage)}`;
}

/**
 * Generates a plain-language explanation for a category trend.
 */
export function generateTrendExplanation(trend: CategoryTrend): string {
  return `${trend.category} spending increased by ${trend.percentageChange.toFixed(0)}% from ${formatCurrency(trend.previousAmount)} to ${formatCurrency(trend.currentAmount)}`;
}
