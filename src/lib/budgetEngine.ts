/**
 * Budget creation and allocation engine.
 * Pure business logic module — no database calls.
 */

import { Category } from '@/models/category';
import { CategoryAllocation } from '@/models/budget';
import { NEEDS_CATEGORIES, WANTS_CATEGORIES } from '@/config/categories';

// --- Types ---

export type Frequency = 'weekly' | 'fortnightly' | 'monthly' | 'yearly';

export interface BudgetGenerationParams {
  totalIncome: number;
  commitments: { amount: number; frequency: Frequency }[];
  savingsContribution: number;
  periodType: 'weekly' | 'monthly';
  historicalSpending?: { category: Category; amount: number }[];
}

export interface BudgetResult {
  success: true;
  allocations: CategoryAllocation[];
  availableIncome: number;
  totalCommitments: number;
  savingsContribution: number;
}

export interface BudgetError {
  success: false;
  error: string;
  shortfall: number;
  /**
   * Which situation stopped the budget being built. 'no-income' means nothing
   * has been recorded yet — a first-run state, not a money problem.
   */
  reason: 'no-income' | 'shortfall';
}

// --- Normalization Functions ---

/**
 * Convert any frequency to monthly equivalent.
 * Weekly: × 4.33, Fortnightly: × 2.17, Monthly: × 1, Yearly: ÷ 12
 */
export function normalizeToMonthly(amount: number, frequency: Frequency): number {
  switch (frequency) {
    case 'weekly':
      return amount * 4.33;
    case 'fortnightly':
      return amount * 2.17;
    case 'monthly':
      return amount;
    case 'yearly':
      return amount / 12;
  }
}

/**
 * Convert any frequency to weekly equivalent.
 * Weekly: × 1, Fortnightly: ÷ 2, Monthly: ÷ 4.33, Yearly: ÷ 52
 */
export function normalizeToWeekly(amount: number, frequency: Frequency): number {
  switch (frequency) {
    case 'weekly':
      return amount;
    case 'fortnightly':
      return amount / 2;
    case 'monthly':
      return amount / 4.33;
    case 'yearly':
      return amount / 52;
  }
}

// --- Budget Generation ---

/**
 * Generate a budget by allocating available income across categories.
 *
 * 1. Normalize commitments to the target period.
 * 2. Calculate available income (totalIncome - commitments - savings).
 * 3. If availableIncome ≤ 0, return an error with the shortfall.
 * 4. Allocate using historical spending proportions or 50/30/20 heuristic.
 * 5. Round to 2dp and adjust largest category to eliminate rounding error.
 */
export function generateBudget(
  params: BudgetGenerationParams
): BudgetResult | BudgetError {
  const { totalIncome, commitments, savingsContribution, periodType, historicalSpending } = params;

  // Normalize all commitments to the target period
  const totalCommitments = commitments.reduce((sum, c) => {
    const normalized =
      periodType === 'monthly'
        ? normalizeToMonthly(c.amount, c.frequency)
        : normalizeToWeekly(c.amount, c.frequency);
    return sum + normalized;
  }, 0);

  const availableIncome = totalIncome - totalCommitments - savingsContribution;

  // No income recorded is a first-run state, not a shortfall. Reporting it as
  // "commitments exceed income" told brand-new users their nonexistent
  // commitments had overrun their nonexistent salary, with a ₦0.00 shortfall.
  if (totalIncome <= 0) {
    return {
      success: false,
      error: 'Add your income before building a budget — there is nothing to divide up yet.',
      shortfall: 0,
      reason: 'no-income',
    };
  }

  // Shortfall check
  if (availableIncome <= 0) {
    return {
      success: false,
      error: 'Financial commitments and savings contributions exceed total income.',
      shortfall: Math.abs(availableIncome),
      reason: 'shortfall',
    };
  }

  let allocations: CategoryAllocation[];

  if (historicalSpending && historicalSpending.length > 0) {
    allocations = allocateFromHistory(historicalSpending, availableIncome);
  } else {
    allocations = allocateWith503020(availableIncome);
  }

  // Round and fix rounding error
  allocations = fixRoundingError(allocations, availableIncome);

  return {
    success: true,
    allocations,
    availableIncome: round2(availableIncome),
    totalCommitments: round2(totalCommitments),
    savingsContribution,
  };
}

// --- Allocation Strategies ---

/**
 * Allocate proportionally based on historical spending.
 */
function allocateFromHistory(
  historicalSpending: { category: Category; amount: number }[],
  availableIncome: number
): CategoryAllocation[] {
  const totalHistorical = historicalSpending.reduce((sum, h) => sum + h.amount, 0);

  if (totalHistorical === 0) {
    // Fallback to equal distribution if all historical amounts are 0
    return allocateWith503020(availableIncome);
  }

  return historicalSpending.map((h) => ({
    category: h.category,
    amount: (h.amount / totalHistorical) * availableIncome,
    is_fixed: false,
  }));
}

/**
 * Allocate using the 50/30/20 heuristic.
 *
 * Per the design algorithm: 50% to needs categories, 30% to wants categories,
 * 20% added back to savings. Since requirement 3.1 requires allocations to
 * equal available income, and the 50/30/20 heuristic is used when there's no
 * history (the user hasn't started spending yet), we distribute 70% across
 * needs and wants (50% needs, 30% wants) and add the 20% to needs categories
 * to keep allocations summing to availableIncome.
 *
 * Each group is split equally among its member categories.
 */
function allocateWith503020(availableIncome: number): CategoryAllocation[] {
  const needsTotal = availableIncome * 0.5;
  const wantsTotal = availableIncome * 0.3;
  const savingsExtra = availableIncome * 0.2;

  const needsPerCategory = needsTotal / NEEDS_CATEGORIES.length;
  const wantsPerCategory = wantsTotal / WANTS_CATEGORIES.length;
  const savingsBonusPerNeed = savingsExtra / NEEDS_CATEGORIES.length;

  const allocations: CategoryAllocation[] = [];

  for (const cat of NEEDS_CATEGORIES) {
    allocations.push({
      category: cat,
      amount: needsPerCategory + savingsBonusPerNeed,
      is_fixed: false,
    });
  }

  for (const cat of WANTS_CATEGORIES) {
    allocations.push({
      category: cat,
      amount: wantsPerCategory,
      is_fixed: false,
    });
  }

  return allocations;
}

// --- Budget Modification ---

/**
 * Modify a single category's allocation and redistribute the difference
 * proportionally across all other non-fixed categories.
 *
 * Maintains invariant: sum of all allocations = availableIncome (±0.01).
 * If newAmount > availableIncome, it is clamped.
 */
export function modifyAllocation(
  allocations: CategoryAllocation[],
  category: Category,
  newAmount: number,
  availableIncome: number
): CategoryAllocation[] {
  // Clamp newAmount
  const clampedAmount = Math.min(newAmount, availableIncome);

  const result = allocations.map((a) => ({ ...a }));

  const targetIndex = result.findIndex((a) => a.category === category);
  if (targetIndex === -1) {
    return result;
  }

  const oldAmount = result[targetIndex].amount;
  const difference = oldAmount - clampedAmount;

  // Set the new amount
  result[targetIndex].amount = clampedAmount;

  // Find non-fixed categories to redistribute across (excluding the modified one)
  const redistributable = result.filter(
    (a, i) => i !== targetIndex && !a.is_fixed
  );

  if (redistributable.length === 0) {
    // No categories to redistribute to; just set and return
    return fixRoundingError(result, availableIncome);
  }

  const redistributableTotal = redistributable.reduce((sum, a) => sum + a.amount, 0);

  if (redistributableTotal === 0) {
    // Distribute equally if all other categories are at 0
    const perCategory = difference / redistributable.length;
    for (const alloc of redistributable) {
      const match = result.find((r) => r.category === alloc.category && !r.is_fixed);
      if (match) {
        match.amount += perCategory;
      }
    }
  } else {
    // Distribute proportionally
    for (const alloc of redistributable) {
      const match = result.find((r) => r.category === alloc.category && !r.is_fixed);
      if (match) {
        const proportion = alloc.amount / redistributableTotal;
        match.amount += difference * proportion;
      }
    }
  }

  // Ensure no negative allocations
  for (const alloc of result) {
    if (alloc.amount < 0) {
      alloc.amount = 0;
    }
  }

  return fixRoundingError(result, availableIncome);
}

// --- Helpers ---

/**
 * Round all allocations to 2dp and adjust the largest category
 * so that the total equals availableIncome exactly.
 */
function fixRoundingError(
  allocations: CategoryAllocation[],
  availableIncome: number
): CategoryAllocation[] {
  const rounded = allocations.map((a) => ({
    ...a,
    amount: round2(a.amount),
  }));

  const total = rounded.reduce((sum, a) => sum + a.amount, 0);
  const diff = round2(availableIncome) - round2(total);

  if (Math.abs(diff) > 0) {
    // Find the largest category to adjust
    let largestIndex = 0;
    let largestAmount = 0;
    for (let i = 0; i < rounded.length; i++) {
      if (rounded[i].amount > largestAmount) {
        largestAmount = rounded[i].amount;
        largestIndex = i;
      }
    }
    rounded[largestIndex].amount = round2(rounded[largestIndex].amount + diff);
  }

  return rounded;
}

/**
 * Round a number to 2 decimal places.
 */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
