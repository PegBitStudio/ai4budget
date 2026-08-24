import { FinancialContext } from './llmClient';

// --- Interfaces ---

export interface QAParams {
  question: string;
  transactions: { amount: number; category: string; date: string; type: string }[];
  budget?: { category: string; budgeted: number; actual: number }[];
  period: string;
  llmClient?: { answerQuestion: (q: string, ctx: FinancialContext) => Promise<string> };
}

export interface QAResult {
  answer: string;
  source: 'local' | 'llm' | 'error';
  needsClarification?: boolean;
}

export interface QAData {
  transactions: { amount: number; category: string; date: string; type: string }[];
  budget?: { category: string; budgeted: number; actual: number }[];
}

export interface QAContextParams {
  transactions: { amount: number; category: string; date: string; type: string }[];
  budget?: { category: string; budgeted: number; actual: number }[];
  period: string;
}

// --- Financial keywords for topic detection ---

const FINANCIAL_KEYWORDS = [
  'spend', 'spent', 'spending',
  'budget', 'budgeted', 'budgeting',
  'income', 'earn', 'earned', 'salary',
  'money', 'cash', 'funds',
  'save', 'saved', 'savings', 'saving',
  'category', 'categories',
  'expense', 'expenses',
  'cost', 'costs',
  'bill', 'bills',
  'payment', 'payments',
  'transaction', 'transactions',
  'groceries', 'housing', 'transport', 'utilities',
  'entertainment', 'dining', 'health', 'shopping', 'subscriptions',
  'total', 'sum', 'average',
  'month', 'monthly', 'week', 'weekly',
  'over budget', 'under budget',
  'allocation', 'allocations',
];

// --- Public Functions ---

/**
 * Determines if a question is related to finances based on keyword matching.
 */
export function isFinancialQuestion(question: string): boolean {
  const lower = question.toLowerCase();
  return FINANCIAL_KEYWORDS.some((keyword) => lower.includes(keyword));
}

/**
 * Build the context object to pass to the LLM.
 * Keeps context small to minimize token usage.
 */
export function buildContext(params: QAContextParams): FinancialContext {
  // Limit transactions to 50 most recent for context size management
  const limitedTransactions = params.transactions
    .slice(-50)
    .map((t) => ({
      category: t.category,
      amount: t.amount,
      date: t.date,
    }));

  return {
    transactions: limitedTransactions,
    budget: params.budget,
    period: params.period,
  };
}

/**
 * Try to answer simple questions without the LLM.
 * Returns null if the question is too complex for local parsing.
 */
export function getLocalAnswer(question: string, data: QAData): string | null {
  const lower = question.toLowerCase();

  // "how much did I spend on [category]?"
  const categorySpendMatch = lower.match(
    /(?:how much|what).*(?:spend|spent|spending).*(?:on|for|in)\s+(.+?)[\s?!.]*$/
  );
  if (categorySpendMatch) {
    const queriedCategory = categorySpendMatch[1].trim();
    const expenses = data.transactions.filter(
      (t) =>
        t.type === 'expense' &&
        t.category.toLowerCase() === queriedCategory.toLowerCase()
    );
    if (expenses.length === 0) {
      return `You haven't spent anything on ${queriedCategory} in this period.`;
    }
    const total = expenses.reduce((sum, t) => sum + t.amount, 0);
    return `You spent $${total.toFixed(2)} on ${expenses[0].category} (${expenses.length} transaction${expenses.length > 1 ? 's' : ''}).`;
  }

  // "what is my total spending?" / "how much have I spent in total?"
  if (
    (lower.includes('total') && lower.includes('spend')) ||
    (lower.includes('how much') && lower.includes('spent') && !lower.includes('on'))
  ) {
    const expenses = data.transactions.filter((t) => t.type === 'expense');
    if (expenses.length === 0) {
      return 'You have no expense transactions recorded for this period.';
    }
    const total = expenses.reduce((sum, t) => sum + t.amount, 0);
    return `Your total spending is $${total.toFixed(2)} across ${expenses.length} transaction${expenses.length > 1 ? 's' : ''}.`;
  }

  // "what is my income?" / "how much did I earn?"
  if (
    lower.includes('income') ||
    lower.includes('earn') ||
    lower.includes('salary')
  ) {
    const incomes = data.transactions.filter((t) => t.type === 'income');
    if (incomes.length === 0) {
      return 'You have no income transactions recorded for this period.';
    }
    const total = incomes.reduce((sum, t) => sum + t.amount, 0);
    return `Your total income is $${total.toFixed(2)} from ${incomes.length} source${incomes.length > 1 ? 's' : ''}.`;
  }

  // Can't answer locally — return null to fall through to LLM
  return null;
}

/**
 * Main Q&A engine that interprets user questions and produces answers.
 * Tries local data first, then falls back to LLM for complex questions.
 */
export async function answerQuestion(params: QAParams): Promise<QAResult> {
  const { question, transactions, budget, period, llmClient } = params;

  // Validate input
  if (!question || question.trim().length === 0) {
    return {
      answer: 'Please ask a question about your finances.',
      source: 'error',
    };
  }

  // Check if the question is about finances
  if (!isFinancialQuestion(question)) {
    return {
      answer: 'I can only answer questions about your financial data. Try asking about your spending, budget, income, or savings.',
      source: 'error',
    };
  }

  // Check if we have any data to work with
  if (transactions.length === 0 && (!budget || budget.length === 0)) {
    return {
      answer: 'There is not enough financial data available to answer your question. Please add some transactions or create a budget first.',
      source: 'error',
    };
  }

  // Try to answer locally first
  const data: QAData = { transactions, budget };
  const localAnswer = getLocalAnswer(question, data);
  if (localAnswer !== null) {
    return {
      answer: localAnswer,
      source: 'local',
    };
  }

  // Fall through to LLM for complex questions
  if (llmClient) {
    try {
      const context = buildContext({ transactions, budget, period });
      const llmAnswer = await llmClient.answerQuestion(question, context);
      return {
        answer: llmAnswer,
        source: 'llm',
      };
    } catch {
      return {
        answer: 'Unable to process your question at this time. Please try again later.',
        source: 'error',
      };
    }
  }

  // No LLM available and can't answer locally
  return {
    answer: 'I couldn\'t determine an answer from your data. Try asking about a specific category, your total spending, or your income.',
    source: 'error',
    needsClarification: true,
  };
}
