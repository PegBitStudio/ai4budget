import { Category } from '@/models/category';
import { formatCurrency } from '@/utils/formatters';

// --- Interfaces ---

export interface SummaryParams {
  income: { amount: number; date: string }[];
  expenses: { amount: number; category: Category; date: string }[];
  budget?: { category: Category; amount: number }[];
  savingsGoal?: { target: number; current: number };
  periodType: 'weekly' | 'monthly';
  periodLabel: string;
}

export interface SummaryData {
  totalIncome: number;
  totalSpending: number;
  topCategories: { name: string; amount: number }[];
  savingsProgress?: { goal: number; current: number };
  isOnTrack: boolean;
  totalBudgeted: number;
  periodType: string;
  periodLabel: string;
  hasData: boolean;
}

export interface SummaryInput {
  totalIncome: number;
  totalSpending: number;
  topCategories: { name: string; amount: number }[];
  savingsProgress?: { goal: number; current: number };
  periodType: string;
}

// --- Functions ---

/**
 * Pure function that aggregates financial data into a summary structure.
 * Calculates totals, identifies top spending categories, and determines budget status.
 */
export function buildSummaryData(params: SummaryParams): SummaryData {
  const totalIncome = params.income.reduce((sum, item) => sum + item.amount, 0);
  const totalSpending = params.expenses.reduce((sum, item) => sum + item.amount, 0);

  // Aggregate spending by category
  const categoryTotals = new Map<string, number>();
  for (const expense of params.expenses) {
    const current = categoryTotals.get(expense.category) ?? 0;
    categoryTotals.set(expense.category, current + expense.amount);
  }

  // Sort categories by amount descending and take top 3
  const topCategories = Array.from(categoryTotals.entries())
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  // Calculate total budgeted amount
  const totalBudgeted = params.budget
    ? params.budget.reduce((sum, item) => sum + item.amount, 0)
    : 0;

  // Determine on-track status: spending ≤ total budgeted
  // If no budget exists, default to on-track (nothing to compare against)
  const isOnTrack = totalBudgeted > 0 ? totalSpending <= totalBudgeted : true;

  // Savings progress
  const savingsProgress = params.savingsGoal
    ? { goal: params.savingsGoal.target, current: params.savingsGoal.current }
    : undefined;

  // Has data if there are any income or expense entries
  const hasData = params.income.length > 0 || params.expenses.length > 0;

  return {
    totalIncome,
    totalSpending,
    topCategories,
    savingsProgress,
    isOnTrack,
    totalBudgeted,
    periodType: params.periodType,
    periodLabel: params.periodLabel,
    hasData,
  };
}

/**
 * Generates a basic plain-text financial summary without LLM (fallback).
 * Uses simple language with no abbreviations or financial jargon.
 */
export function generatePlainTextSummary(data: SummaryData): string {
  if (!data.hasData) {
    return 'There is not enough data to generate a summary. Please add your income and expense transactions to get started.';
  }

  const lines: string[] = [];

  // Income and spending overview
  lines.push(
    `This ${data.periodType === 'weekly' ? 'week' : 'month'}, you earned ${formatCurrency(data.totalIncome)} and spent ${formatCurrency(data.totalSpending)}.`
  );

  // Top spending categories
  if (data.topCategories.length > 0) {
    const categoryList = data.topCategories
      .map((cat) => `${cat.name} (${formatCurrency(cat.amount)})`)
      .join(', ');
    lines.push(`Your top spending areas were: ${categoryList}.`);
  }

  // On-track or over-budget assessment
  if (data.totalBudgeted > 0) {
    const status = data.isOnTrack ? 'on track' : 'over budget';
    lines.push(
      `You are ${status} — ${formatCurrency(data.totalSpending)} of ${formatCurrency(data.totalBudgeted)} spent.`
    );
  }

  // Savings progress
  if (data.savingsProgress) {
    lines.push(
      `You've saved ${formatCurrency(data.savingsProgress.current)} toward your ${formatCurrency(data.savingsProgress.goal)} target.`
    );
  }

  return lines.join(' ');
}

/**
 * Generates a financial summary, using LLM when available or falling back to plain text.
 * Handles insufficient data by returning a helpful message about what's needed.
 */
export async function generateSummary(
  data: SummaryData,
  useLLM: boolean,
  llmClient?: { generateSummary: (input: SummaryInput) => Promise<string> }
): Promise<string> {
  // Handle insufficient data
  if (!data.hasData) {
    return 'There is not enough data to generate a summary. Please add your income and expense transactions to get started.';
  }

  // Try LLM generation if enabled and client available
  if (useLLM && llmClient) {
    try {
      const input: SummaryInput = {
        totalIncome: data.totalIncome,
        totalSpending: data.totalSpending,
        topCategories: data.topCategories,
        savingsProgress: data.savingsProgress,
        periodType: data.periodType,
      };
      const result = await llmClient.generateSummary(input);
      return result;
    } catch {
      // Fall back to plain text on LLM failure
      return generatePlainTextSummary(data);
    }
  }

  // Fallback: generate plain-text summary
  return generatePlainTextSummary(data);
}
