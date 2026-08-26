import OpenAI from 'openai';
import { Category, CATEGORIES } from '@/models/category';
import type { RawParsedAlert } from './alertParser';
import { formatCurrency } from '@/utils/formatters';

// --- Interfaces ---

export interface SummaryInput {
  totalIncome: number;
  totalSpending: number;
  topCategories: { name: string; amount: number }[];
  savingsProgress?: { goal: number; current: number };
  periodType: string;
}

export interface FinancialContext {
  /**
   * `type` matters: without it the assistant read a salary credit as another
   * line of spending and blamed the user's income for their overspending.
   */
  transactions: {
    category: string;
    amount: number;
    date: string;
    type: 'income' | 'expense';
  }[];
  budget?: { category: string; budgeted: number; actual: number }[];
  period: string;
}

export interface ILLMClient {
  classifyTransaction(description: string): Promise<Category | null>;
  generateSummary(data: SummaryInput): Promise<string>;
  answerQuestion(question: string, context: FinancialContext): Promise<string>;
  parseBankAlerts(text: string): Promise<RawParsedAlert[] | null>;
  isAvailable(): boolean;
}

// --- Constants ---

const MODEL = 'gpt-4o-mini';
const CURRENCY = '₦';
const TIMEOUT_MS = 10_000;
/** Parsing a full paste of alerts needs more room than a single question. */
const PARSE_TIMEOUT_MS = 45_000;
const MAX_TOKENS = 900;
const PARSE_MAX_TOKENS = 8_000;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

const CLASSIFY_SYSTEM_PROMPT =
  'You are a transaction classifier. Given a transaction description, return ONLY one of these categories: Housing, Transport, Groceries, Utilities, Entertainment, Dining, Health, Shopping, Subscriptions, Other. Respond with just the category name, nothing else.';

const SUMMARY_SYSTEM_PROMPT =
  'All money amounts are in Nigerian Naira and must always be written with the ₦ symbol - never convert to dollars or any other currency. You are a helpful financial assistant. Generate a plain-language summary of the user\'s finances. Use simple language that anyone can understand. Avoid abbreviations and financial jargon. Include a one-sentence assessment of whether the user is on track or over budget. Be concise and friendly.';

const QA_SYSTEM_PROMPT =
  'All money amounts are in Nigerian Naira and must always be written with the ₦ symbol - never convert to dollars or any other currency. Write every amount as a finished figure, for example ₦218,200.00. Never show your arithmetic: do not write expressions like "₦(535,000.00 - 753,200.00)" or "= -₦218,200.00" - state the result on its own. Keep answers under 150 words: lead with the direct answer, then at most three short bullet points. Do not list every category unless asked. You are a financial data assistant. You can ONLY answer questions about the user\'s financial data provided in the context. Rules: 1) If the question is unrelated to finances, politely decline and say you can only help with financial questions. 2) If the question is ambiguous, ask a clarifying follow-up question. 3) Always include specific numeric values (amounts, percentages, totals) in your answers. 4) Never make up data - only reference what is in the provided context. 5) You must never recommend or evaluate an investment, a savings product, or what someone should do with money beyond budgeting it. If asked, say plainly that this is budgeting support and not financial advice, and that a licensed adviser is the right place for that question.';

const PARSE_ALERTS_SYSTEM_PROMPT = `You extract transactions from Nigerian bank debit and credit alert messages.

The user pastes raw alert text — SMS or email — from banks such as GTBank, Zenith, Access, First Bank, UBA, Kuda, Opay, PalmPay and Moniepoint. Formats vary widely. One paste may contain many alerts, in any order, separated by blank lines or run together.

Return ONLY a JSON object of the form:
{"transactions": [{"date": "YYYY-MM-DD", "description": "...", "amount": 0, "type": "expense"}]}

Rules:
- One object per transaction. Return an empty array if the text contains no transactions.
- "amount" is a positive number with no currency symbol, no commas, no DR/CR suffix.
- "date" must be YYYY-MM-DD. Alerts use formats like 12-AUG-2026, 05/08/2026 and 4 Aug 2026; numeric dates are DAY first. If an alert gives no year, use the most recent year in which that day and month have already passed.
- "type" is "expense" for money leaving the account (debit, DR, "you sent", "purchase", "withdrawal") and "income" for money arriving (credit, CR, "you received", "salary", "transfer in").
- "description" is the merchant or narration in plain words, e.g. "Bolt ride", "Shoprite", "MTN airtime", "Salary from Zenith Bank". Strip account numbers, reference codes, terminal IDs and balance figures. Never include an account number.
- Ignore balance figures entirely — the available balance is not a transaction.
- Skip anything that is not a transaction: OTPs, marketing messages, login notices, statement summaries.
- Never invent a transaction. If a field is genuinely unreadable, omit that transaction rather than guessing.
- Be exhaustive. Every message describing money moving must produce its own entry — work through the text top to bottom and do not stop early or summarise. Missing a real transaction is the worst failure here.`;

// --- Helper: sleep for exponential backoff ---

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Helper: check if error is a rate limit (429) ---

function isRateLimitError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'status' in error) {
    return (error as { status: number }).status === 429;
  }
  return false;
}

// --- LLM Client Implementation ---

export class LLMClient implements ILLMClient {
  private client: OpenAI;

  constructor(client?: OpenAI) {
    this.client = client ?? new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  isAvailable(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  async classifyTransaction(description: string): Promise<Category | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const response = await this.callWithRetry(
        CLASSIFY_SYSTEM_PROMPT,
        description
      );

      if (!response) {
        return null;
      }

      const trimmed = response.trim();
      if (CATEGORIES.includes(trimmed as Category)) {
        return trimmed as Category;
      }

      // Try case-insensitive match
      const matched = CATEGORIES.find(
        (c) => c.toLowerCase() === trimmed.toLowerCase()
      );
      return matched ?? null;
    } catch {
      return null;
    }
  }

  async generateSummary(data: SummaryInput): Promise<string> {
    if (!this.isAvailable()) {
      return 'Financial summary is temporarily unavailable. Please try again later.';
    }

    const userMessage = this.buildSummaryPrompt(data);

    try {
      const response = await this.callWithRetry(
        SUMMARY_SYSTEM_PROMPT,
        userMessage
      );

      if (!response) {
        return 'Unable to generate summary at this time. Please try again later.';
      }

      return response;
    } catch {
      return 'Unable to generate summary at this time. Please try again later.';
    }
  }

  async answerQuestion(
    question: string,
    context: FinancialContext
  ): Promise<string> {
    if (!this.isAvailable()) {
      return 'The Q&A feature is temporarily unavailable. Please try again later.';
    }

    const userMessage = this.buildQAPrompt(question, context);

    try {
      const response = await this.callWithRetry(QA_SYSTEM_PROMPT, userMessage);

      if (!response) {
        return 'Unable to answer your question at this time. Please try again later.';
      }

      return response;
    } catch {
      return 'Unable to answer your question at this time. Please try again later.';
    }
  }

  /**
   * Extracts transactions from a paste of raw bank alert messages.
   *
   * Returns the model's rows untouched — validation and normalisation belong
   * to alertParser, and nothing here is trusted enough to store. Returns null
   * when the model is unavailable or the reply cannot be read as JSON.
   */
  async parseBankAlerts(text: string): Promise<RawParsedAlert[] | null> {
    if (!this.isAvailable()) {
      return null;
    }

    // Anchor relative dates ("yesterday", alerts with no year) to today.
    const today = new Date();
    const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const userMessage = `Today's date is ${todayISO}.\n\nExtract every transaction from these alerts:\n\n${text}`;

    try {
      const response = await this.callWithRetry(
        PARSE_ALERTS_SYSTEM_PROMPT,
        userMessage,
        {
          json: true,
          maxTokens: PARSE_MAX_TOKENS,
          timeoutMs: PARSE_TIMEOUT_MS,
          // Extraction is a reading task, not a creative one.
          temperature: 0,
        }
      );

      if (!response) {
        return null;
      }

      const parsed = JSON.parse(response) as {
        transactions?: unknown;
      };

      if (!Array.isArray(parsed.transactions)) {
        return null;
      }

      return parsed.transactions as RawParsedAlert[];
    } catch {
      return null;
    }
  }

  // --- Private Methods ---

  private buildSummaryPrompt(data: SummaryInput): string {
    let prompt = `Please summarize the following financial data for the ${data.periodType} period:\n\n`;
    prompt += `- Total Income: ${formatCurrency(data.totalIncome)}\n`;
    prompt += `- Total Spending: ${formatCurrency(data.totalSpending)}\n`;
    prompt += `- Net: ${formatCurrency(data.totalIncome - data.totalSpending)}\n\n`;

    if (data.topCategories.length > 0) {
      prompt += 'Top spending categories:\n';
      for (const cat of data.topCategories) {
        prompt += `  - ${cat.name}: ${formatCurrency(cat.amount)}\n`;
      }
      prompt += '\n';
    }

    if (data.savingsProgress) {
      prompt += `Savings progress: ${formatCurrency(data.savingsProgress.current)} saved toward a ${formatCurrency(data.savingsProgress.goal)} goal.\n`;
    }

    return prompt;
  }

  private buildQAPrompt(question: string, context: FinancialContext): string {
    let prompt = `User's financial context for period: ${context.period}\n\n`;

    // Income and expenses are listed separately and labelled. Presented as one
    // undifferentiated list, a salary credit reads as a very large expense.
    const income = context.transactions.filter((t) => t.type === 'income');
    const expenses = context.transactions.filter((t) => t.type !== 'income');

    if (income.length > 0) {
      const totalIncome = income.reduce((sum, t) => sum + t.amount, 0);
      prompt += `Money received (income, NOT spending) — total ${formatCurrency(totalIncome)}:\n`;
      for (const t of income) {
        prompt += `  - ${t.date}: ${formatCurrency(t.amount)}\n`;
      }
      prompt += '\n';
    }

    if (expenses.length > 0) {
      const totalSpent = expenses.reduce((sum, t) => sum + t.amount, 0);
      prompt += `Money spent (expenses) — total ${formatCurrency(totalSpent)}:\n`;
      for (const t of expenses) {
        prompt += `  - ${t.date}: ${t.category} - ${formatCurrency(t.amount)}\n`;
      }
      prompt += '\n';
    }

    if (context.budget && context.budget.length > 0) {
      prompt += 'Budget breakdown:\n';
      for (const b of context.budget) {
        prompt += `  - ${b.category}: Budgeted ${formatCurrency(b.budgeted)}, Actual ${formatCurrency(b.actual)}\n`;
      }
      prompt += '\n';
    }

    prompt += `User question: ${question}`;
    return prompt;
  }

  private async callWithRetry(
    systemPrompt: string,
    userMessage: string,
    options: {
      maxTokens?: number;
      timeoutMs?: number;
      json?: boolean;
      temperature?: number;
    } = {}
  ): Promise<string | null> {
    const {
      maxTokens = MAX_TOKENS,
      timeoutMs = TIMEOUT_MS,
      json = false,
      temperature = 0.3,
    } = options;
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        // Only retry on rate limit errors
        if (!isRateLimitError(lastError)) {
          break;
        }
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
        await sleep(backoff);
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const response = await this.client.chat.completions.create(
          {
            model: MODEL,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userMessage },
            ],
            temperature,
            max_tokens: maxTokens,
            ...(json
              ? { response_format: { type: 'json_object' as const } }
              : {}),
          },
          { signal: controller.signal }
        );

        clearTimeout(timeoutId);

        const content = response.choices[0]?.message?.content ?? null;

        // Track token usage
        if (response.usage) {
          console.log(
            `[LLM] Token usage - prompt: ${response.usage.prompt_tokens}, completion: ${response.usage.completion_tokens}, total: ${response.usage.total_tokens}`
          );
        }

        return content;
      } catch (error) {
        lastError = error;

        // If it's not a rate limit error, don't retry
        if (!isRateLimitError(error)) {
          break;
        }
      }
    }

    return null;
  }
}

// --- Singleton export for use in API routes ---

let llmClientInstance: LLMClient | null = null;

export function getLLMClient(): LLMClient {
  if (!llmClientInstance) {
    llmClientInstance = new LLMClient();
  }
  return llmClientInstance;
}
