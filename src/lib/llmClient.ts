import OpenAI from 'openai';
import { Category, CATEGORIES } from '@/models/category';

// --- Interfaces ---

export interface SummaryInput {
  totalIncome: number;
  totalSpending: number;
  topCategories: { name: string; amount: number }[];
  savingsProgress?: { goal: number; current: number };
  periodType: string;
}

export interface FinancialContext {
  transactions: { category: string; amount: number; date: string }[];
  budget?: { category: string; budgeted: number; actual: number }[];
  period: string;
}

export interface ILLMClient {
  classifyTransaction(description: string): Promise<Category | null>;
  generateSummary(data: SummaryInput): Promise<string>;
  answerQuestion(question: string, context: FinancialContext): Promise<string>;
  isAvailable(): boolean;
}

// --- Constants ---

const MODEL = 'gpt-4o-mini';
const CURRENCY = '₦';
const TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

const CLASSIFY_SYSTEM_PROMPT =
  'You are a transaction classifier. Given a transaction description, return ONLY one of these categories: Housing, Transport, Groceries, Utilities, Entertainment, Dining, Health, Shopping, Subscriptions, Other. Respond with just the category name, nothing else.';

const SUMMARY_SYSTEM_PROMPT =
  'All money amounts are in Nigerian Naira and must always be written with the ₦ symbol - never convert to dollars or any other currency. You are a helpful financial assistant. Generate a plain-language summary of the user\'s finances. Use simple language that anyone can understand. Avoid abbreviations and financial jargon. Include a one-sentence assessment of whether the user is on track or over budget. Be concise and friendly.';

const QA_SYSTEM_PROMPT =
  'All money amounts are in Nigerian Naira and must always be written with the ₦ symbol - never convert to dollars or any other currency. Keep answers under 150 words: lead with the direct answer, then at most three short bullet points. Do not list every category unless asked. You are a financial data assistant. You can ONLY answer questions about the user\'s financial data provided in the context. Rules: 1) If the question is unrelated to finances, politely decline and say you can only help with financial questions. 2) If the question is ambiguous, ask a clarifying follow-up question. 3) Always include specific numeric values (amounts, percentages, totals) in your answers. 4) Never make up data - only reference what is in the provided context.';

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

  // --- Private Methods ---

  private buildSummaryPrompt(data: SummaryInput): string {
    let prompt = `Please summarize the following financial data for the ${data.periodType} period:\n\n`;
    prompt += `- Total Income: ${CURRENCY}${data.totalIncome.toFixed(2)}\n`;
    prompt += `- Total Spending: ${CURRENCY}${data.totalSpending.toFixed(2)}\n`;
    prompt += `- Net: ${CURRENCY}${(data.totalIncome - data.totalSpending).toFixed(2)}\n\n`;

    if (data.topCategories.length > 0) {
      prompt += 'Top spending categories:\n';
      for (const cat of data.topCategories) {
        prompt += `  - ${cat.name}: ${CURRENCY}${cat.amount.toFixed(2)}\n`;
      }
      prompt += '\n';
    }

    if (data.savingsProgress) {
      prompt += `Savings progress: ${CURRENCY}${data.savingsProgress.current.toFixed(2)} saved toward a ${CURRENCY}${data.savingsProgress.goal.toFixed(2)} goal.\n`;
    }

    return prompt;
  }

  private buildQAPrompt(question: string, context: FinancialContext): string {
    let prompt = `User's financial context for period: ${context.period}\n\n`;

    if (context.transactions.length > 0) {
      prompt += 'Recent transactions:\n';
      for (const t of context.transactions) {
        prompt += `  - ${t.date}: ${t.category} - ${CURRENCY}${t.amount.toFixed(2)}\n`;
      }
      prompt += '\n';
    }

    if (context.budget && context.budget.length > 0) {
      prompt += 'Budget breakdown:\n';
      for (const b of context.budget) {
        prompt += `  - ${b.category}: Budgeted ${CURRENCY}${b.budgeted.toFixed(2)}, Actual ${CURRENCY}${b.actual.toFixed(2)}\n`;
      }
      prompt += '\n';
    }

    prompt += `User question: ${question}`;
    return prompt;
  }

  private async callWithRetry(
    systemPrompt: string,
    userMessage: string
  ): Promise<string | null> {
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
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        const response = await this.client.chat.completions.create(
          {
            model: MODEL,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userMessage },
            ],
            temperature: 0.3,
            max_tokens: 900,
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
