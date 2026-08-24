/**
 * Spending comparison and pattern detection logic.
 * Pure business logic — no database calls.
 */

import { Category } from '@/models/category';
import { BudgetComparison, CategoryAllocation } from '@/models/budget';

export interface SpendingAnomaly {
  transaction: {
    id: string;
    amount: number;
    category: Category;
    date: string;
    description: string;
  };
  categoryAverage: number;
  multiple: number;
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

/**
 * Detects anomalous transactions in the current period.
 *
 * A transaction is flagged as unusual when:
 * - Its amount > 2× the category average (computed from allTransactions)
 * - There are at least 3 prior transactions in that category
 */
export function detectAnomalies(
  transactions: {
    amount: number;
    category: Category;
    date: string;
    description: string;
    id: string;
  }[],
  allTransactions: { amount: number; category: Category }[]
): SpendingAnomaly[] {
  const anomalies: SpendingAnomaly[] = [];

  for (const tx of transactions) {
    const categoryTransactions = allTransactions.filter(
      (t) => t.category === tx.category
    );

    if (categoryTransactions.length < 3) {
      continue;
    }

    const categoryAverage =
      categoryTransactions.reduce((sum, t) => sum + t.amount, 0) /
      categoryTransactions.length;

    if (tx.amount > 2 * categoryAverage) {
      const multiple = tx.amount / categoryAverage;
      anomalies.push({
        transaction: {
          id: tx.id,
          amount: tx.amount,
          category: tx.category,
          date: tx.date,
          description: tx.description,
        },
        categoryAverage,
        multiple,
      });
    }
  }

  return anomalies;
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
  return `This ${anomaly.transaction.description} of ${anomaly.transaction.amount.toFixed(2)} is ${anomaly.multiple.toFixed(1)}× the average ${anomaly.transaction.category} transaction of ${anomaly.categoryAverage.toFixed(2)}`;
}

/**
 * Generates a plain-language explanation for a category trend.
 */
export function generateTrendExplanation(trend: CategoryTrend): string {
  return `${trend.category} spending increased by ${trend.percentageChange.toFixed(0)}% from ${trend.previousAmount.toFixed(2)} to ${trend.currentAmount.toFixed(2)}`;
}
