import { FinancialContext } from './llmClient';
import { formatCurrency } from '@/utils/formatters';

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
  // How people actually phrase it when they want advice rather than a figure.
  'cut', 'reduce', 'afford', 'overspend', 'overspending',
  'left', 'remaining', 'goal', 'target', 'track',
  'owe', 'debt', 'balance', 'naira',
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
  // Limit transactions to 50 most recent for context size management.
  // `type` must survive: without it the assistant cannot tell a salary credit
  // from a large purchase.
  const limitedTransactions = params.transactions
    .slice(-50)
    .map((t) => ({
      category: t.category,
      amount: t.amount,
      date: t.date,
      type: t.type === 'income' ? ('income' as const) : ('expense' as const),
    }));

  return {
    transactions: limitedTransactions,
    budget: params.budget,
    period: params.period,
  };
}

/**
 * Questions asking the product to recommend an investment, a product, or what
 * to do with money beyond budgeting it.
 *
 * Matched on the ask, not on the noun: "how much did I spend on my pension" is
 * a spending question and must still be answered, while "should I buy shares"
 * must not be. So a hit needs both a subject we will not advise on and a phrasing
 * that is seeking a recommendation.
 */
const INVESTMENT_SUBJECTS = [
  'invest', 'investing', 'investment', 'stock', 'stocks', 'share', 'shares',
  'crypto', 'bitcoin', 'forex', 'bond', 'bonds', 'mutual fund', 'etf',
  'portfolio', 'treasury bill', 't-bill', 'real estate', 'property',
];

const ADVICE_PHRASINGS = [
  'should i', 'should we', 'is it safe', 'is it wise', 'is it a good',
  'recommend', 'advise', 'advice', 'worth it', 'how much should',
  'where should', 'what should i put', 'good idea', 'better to',
];

/**
 * True when the user is asking to be told what to do with their money rather
 * than what they have done with it.
 */
/**
 * Asking where to place money names no investment at all — "what should I put
 * my savings into" is the same question as "should I buy shares", and has to
 * be caught on its own shape.
 */
const PLACEMENT_PATTERNS = [
  /(put|move|place)\s+(my\s+)?(savings|money|cash|salary|income)\s+(in|into|somewhere)/,
  /where\s+(should|do|can)\s+(i|we)\s+(put|keep|save|invest)/,
  /what\s+(should|can)\s+(i|we)\s+do\s+with\s+(my\s+)?(savings|money|cash)/,
];

export function isInvestmentAdviceRequest(question: string): boolean {
  const lower = question.toLowerCase();

  if (PLACEMENT_PATTERNS.some((pattern) => pattern.test(lower))) {
    return true;
  }

  const subject = INVESTMENT_SUBJECTS.some((word) => lower.includes(word));
  const asking = ADVICE_PHRASINGS.some((phrase) => lower.includes(phrase));
  return subject && asking;
}

/**
 * The decline.
 *
 * Written here rather than left to the model, because the one answer in this
 * product that must never vary with sampling temperature is the one about the
 * limits of the product. It says three things in order: what it will not do,
 * why, and what it can do instead — a refusal that hands you nothing is just a
 * dead end, and the honest alternative is genuinely useful.
 */
export function investmentAdviceDecline(data: QAData): string {
  const income = data.transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  const spending = data.transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  const left = income - spending;

  const opening =
    'I can’t advise on investments — whether something is a safe place for your money, or how much to put into it. That is regulated financial advice and it needs a licensed adviser who knows your full circumstances. KoboPilot only does budgeting.';

  if (income === 0 && spending === 0) {
    return `${opening}\n\nWhat I can do is work out what you have spare once your spending is recorded. Add some transactions and ask me again.`;
  }

  if (left > 0) {
    return `${opening}\n\nWhat I can tell you is what is actually spare. This period you brought in ${formatCurrency(income)} and spent ${formatCurrency(spending)}, leaving ${formatCurrency(left)}. Whatever you decide to do with money, that figure is the honest ceiling — and it is worth checking against your savings goal before committing any of it.`;
  }

  return `${opening}\n\nWhat I can tell you is that there is nothing spare to commit right now. This period you brought in ${formatCurrency(income)} and spent ${formatCurrency(spending)} — ${formatCurrency(Math.abs(left))} more than you earned. Closing that gap comes before putting money anywhere else.`;
}

/**
 * Try to answer simple questions without the LLM.
 * Returns null if the question is too complex for local parsing.
 */
export function getLocalAnswer(question: string, data: QAData): string | null {
  const lower = question.toLowerCase();

  // Handled before anything else, so no phrasing can route around it into the
  // model. This is the product's own boundary, not a judgement call.
  if (isInvestmentAdviceRequest(question)) {
    return investmentAdviceDecline(data);
  }

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
    return `You spent ${formatCurrency(total)} on ${expenses[0].category} (${expenses.length} transaction${expenses.length > 1 ? 's' : ''}).`;
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
    return `Your total spending is ${formatCurrency(total)} across ${expenses.length} transaction${expenses.length > 1 ? 's' : ''}.`;
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
    return `Your total income is ${formatCurrency(total)} from ${incomes.length} source${incomes.length > 1 ? 's' : ''}.`;
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

  // Answered before the keyword gate and before the "enough data" check: what
  // this product will not do does not depend on how much it knows about you,
  // and an empty account asking about shares deserves the boundary, not
  // "there is not enough financial data".
  if (isInvestmentAdviceRequest(question)) {
    return {
      answer: investmentAdviceDecline({ transactions, budget }),
      source: 'local',
    };
  }

  // A keyword match is a fast path to "yes, this is financial", not a gate.
  // Refusing everything it does not recognise turned away perfectly ordinary
  // questions — "what should I cut first?" contains no keyword at all. When the
  // keywords miss and an LLM is available, let the model judge; its system
  // prompt already instructs it to decline anything off-topic.
  if (!isFinancialQuestion(question) && !llmClient) {
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
