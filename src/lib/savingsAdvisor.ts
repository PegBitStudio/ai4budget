/**
 * Savings Recommendation Advisor
 *
 * Pure business logic module for generating savings recommendations
 * based on user goals, income, and commitments.
 */

import { getMonthsBetween } from '@/utils/dateUtils';
import { formatCurrency } from '@/utils/formatters';

export interface SavingsRecommendationParams {
  savingsGoal?: {
    targetAmount: number;
    currentAmount: number;
    deadline?: string;
  };
  discretionaryIncome: number; // income - commitments (monthly)
  averageMonthlyIncome?: number;
}

export interface SavingsRecommendation {
  monthlyContribution: number;
  isExcessive: boolean; // > 30% of discretionary income
  alternatives?: {
    longerTimeline?: { months: number; monthlyAmount: number };
    reducedGoal?: { amount: number; monthlyAmount: number };
  };
  explanation: string;
  hasGoal: boolean;
}

const EXCESSIVE_THRESHOLD = 0.3; // 30% of discretionary income
const DEFAULT_SAVINGS_RATE = 0.1; // 10%
const STARTER_TARGET_RATE = 0.1; // 10% of average monthly income

/**
 * Calculates the number of months between today and a deadline.
 * Returns null if no deadline is provided.
 */
export function calculateMonthsToGoal(
  goalAmount: number,
  currentSaved: number,
  deadline: string | undefined
): number | null {
  if (!deadline) {
    return null;
  }

  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  return getMonthsBetween(todayStr, deadline);
}

/**
 * Generates a savings recommendation based on the user's goals and financial situation.
 */
export function getRecommendation(
  params: SavingsRecommendationParams
): SavingsRecommendation {
  const { savingsGoal, discretionaryIncome, averageMonthlyIncome } = params;

  // Case: No savings goal — recommend a starter target
  if (!savingsGoal) {
    const income = averageMonthlyIncome ?? discretionaryIncome;
    const starterTarget = roundTo2(income * STARTER_TARGET_RATE);

    return {
      monthlyContribution: starterTarget,
      isExcessive: false,
      explanation: `You don't have a savings goal yet. Start by saving ${formatCurrency(starterTarget)} per month, which is 10% of your average monthly income. Set up an automatic transfer on payday to make it effortless.`,
      hasGoal: false,
    };
  }

  const remainingAmount = savingsGoal.targetAmount - savingsGoal.currentAmount;

  // Calculate monthly contribution
  let monthlyContribution: number;
  const monthsToDeadline = calculateMonthsToGoal(
    savingsGoal.targetAmount,
    savingsGoal.currentAmount,
    savingsGoal.deadline
  );

  if (monthsToDeadline !== null && monthsToDeadline > 0) {
    // WITH deadline: divide remaining by months
    monthlyContribution = roundTo2(remainingAmount / monthsToDeadline);
  } else if (monthsToDeadline === 0) {
    // Deadline is this month — entire remaining amount
    monthlyContribution = roundTo2(remainingAmount);
  } else {
    // WITHOUT deadline: 10% of discretionary income
    monthlyContribution = roundTo2(discretionaryIncome * DEFAULT_SAVINGS_RATE);
  }

  // Check if contribution is excessive (> 30% of discretionary income)
  const isExcessive =
    discretionaryIncome > 0 &&
    monthlyContribution > discretionaryIncome * EXCESSIVE_THRESHOLD;

  let alternatives: SavingsRecommendation['alternatives'] | undefined;

  if (isExcessive) {
    // Calculate alternatives
    // Alternative 1: Longer timeline — how many months at 30% of discretionary income
    const safeMonthly = roundTo2(discretionaryIncome * EXCESSIVE_THRESHOLD);
    const longerMonths =
      safeMonthly > 0 ? Math.ceil(remainingAmount / safeMonthly) : 0;

    // Alternative 2: Reduced goal — what goal can be reached with 30% in the original timeframe
    let reducedGoal: { amount: number; monthlyAmount: number } | undefined;
    if (monthsToDeadline !== null && monthsToDeadline > 0) {
      const achievableAmount = roundTo2(
        safeMonthly * monthsToDeadline + savingsGoal.currentAmount
      );
      reducedGoal = {
        amount: achievableAmount,
        monthlyAmount: safeMonthly,
      };
    } else {
      // Without deadline, suggest a reduced target achievable at safe monthly rate in 12 months
      const achievableAmount = roundTo2(
        safeMonthly * 12 + savingsGoal.currentAmount
      );
      reducedGoal = {
        amount: achievableAmount,
        monthlyAmount: safeMonthly,
      };
    }

    alternatives = {
      longerTimeline: { months: longerMonths, monthlyAmount: safeMonthly },
      reducedGoal,
    };
  }

  const explanation = buildExplanation(
    monthlyContribution,
    savingsGoal,
    monthsToDeadline,
    isExcessive,
    discretionaryIncome,
    alternatives
  );

  return {
    monthlyContribution,
    isExcessive,
    alternatives,
    explanation,
    hasGoal: true,
  };
}

/**
 * Formats a SavingsRecommendation into a plain-language string.
 */
export function formatRecommendation(rec: SavingsRecommendation): string {
  return rec.explanation;
}

// --- Internal helpers ---

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildExplanation(
  monthlyContribution: number,
  savingsGoal: NonNullable<SavingsRecommendationParams['savingsGoal']>,
  monthsToDeadline: number | null,
  isExcessive: boolean,
  discretionaryIncome: number,
  alternatives?: SavingsRecommendation['alternatives']
): string {
  const targetFormatted = formatCurrency(savingsGoal.targetAmount);
  const contributionFormatted = formatCurrency(monthlyContribution);

  if (!isExcessive) {
    if (monthsToDeadline !== null && monthsToDeadline > 0) {
      return `To reach your ${targetFormatted} goal by your deadline, save ${contributionFormatted} per month. Set aside this amount from each paycheck to stay on track.`;
    }
    if (monthsToDeadline === 0) {
      return `Your deadline is this month. You need ${contributionFormatted} to reach your ${targetFormatted} goal. Consider if you can make a lump-sum transfer now.`;
    }
    return `To work toward your ${targetFormatted} goal, save ${contributionFormatted} per month (10% of your discretionary income). Automate this transfer to build the habit.`;
  }

  // Excessive case
  const percentage = discretionaryIncome > 0
    ? roundTo2((monthlyContribution / discretionaryIncome) * 100)
    : 0;

  let explanation = `This would require ${contributionFormatted}/month which is ${percentage}% of your available income.`;

  if (alternatives) {
    explanation += ' Consider:';
    if (alternatives.longerTimeline) {
      explanation += ` (1) Extend your timeline to ${alternatives.longerTimeline.months} months, requiring ${formatCurrency(alternatives.longerTimeline.monthlyAmount)}/month.`;
    }
    if (alternatives.reducedGoal) {
      explanation += ` (2) Reduce your target to ${formatCurrency(alternatives.reducedGoal.amount)}, saving ${formatCurrency(alternatives.reducedGoal.monthlyAmount)}/month.`;
    }
  }

  return explanation;
}
