import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LLMClient, SummaryInput, FinancialContext } from './llmClient';

// Mock OpenAI client factory
function createMockOpenAI(responseContent: string | null, usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }) {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: responseContent } }],
          usage: usage ?? { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      },
    },
  } as any;
}

function createErrorOpenAI(error: any) {
  return {
    chat: {
      completions: {
        create: vi.fn().mockRejectedValue(error),
      },
    },
  } as any;
}

describe('LLMClient', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalEnv;
    }
  });

  describe('isAvailable', () => {
    it('returns true when OPENAI_API_KEY is set', () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      const client = new LLMClient(createMockOpenAI('test'));
      expect(client.isAvailable()).toBe(true);
    });

    it('returns false when OPENAI_API_KEY is not set', () => {
      delete process.env.OPENAI_API_KEY;
      const client = new LLMClient(createMockOpenAI('test'));
      expect(client.isAvailable()).toBe(false);
    });

    it('returns false when OPENAI_API_KEY is empty string', () => {
      process.env.OPENAI_API_KEY = '';
      const client = new LLMClient(createMockOpenAI('test'));
      expect(client.isAvailable()).toBe(false);
    });
  });

  describe('classifyTransaction', () => {
    it('sends correct system prompt for classification', async () => {
      const mockClient = createMockOpenAI('Groceries');
      const client = new LLMClient(mockClient);

      await client.classifyTransaction('Woolworths purchase');

      expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('You are a transaction classifier'),
            }),
            expect.objectContaining({
              role: 'user',
              content: 'Woolworths purchase',
            }),
          ]),
          model: 'gpt-4o-mini',
        }),
        expect.any(Object)
      );
    });

    it('returns a valid category when response is valid', async () => {
      const mockClient = createMockOpenAI('Groceries');
      const client = new LLMClient(mockClient);

      const result = await client.classifyTransaction('Woolworths purchase');
      expect(result).toBe('Groceries');
    });

    it('handles all valid categories', async () => {
      const categories = [
        'Housing', 'Transport', 'Groceries', 'Utilities',
        'Entertainment', 'Dining', 'Health', 'Shopping',
        'Subscriptions', 'Other',
      ];

      for (const category of categories) {
        const mockClient = createMockOpenAI(category);
        const client = new LLMClient(mockClient);
        const result = await client.classifyTransaction('test description');
        expect(result).toBe(category);
      }
    });

    it('handles case-insensitive category matching', async () => {
      const mockClient = createMockOpenAI('groceries');
      const client = new LLMClient(mockClient);

      const result = await client.classifyTransaction('Coles shop');
      expect(result).toBe('Groceries');
    });

    it('returns null for invalid category response', async () => {
      const mockClient = createMockOpenAI('InvalidCategory');
      const client = new LLMClient(mockClient);

      const result = await client.classifyTransaction('some purchase');
      expect(result).toBeNull();
    });

    it('returns null when response has extra text', async () => {
      const mockClient = createMockOpenAI('I think this is Groceries because...');
      const client = new LLMClient(mockClient);

      const result = await client.classifyTransaction('Coles shop');
      expect(result).toBeNull();
    });

    it('returns null when response is null', async () => {
      const mockClient = createMockOpenAI(null);
      const client = new LLMClient(mockClient);

      const result = await client.classifyTransaction('purchase');
      expect(result).toBeNull();
    });

    it('returns null when API key is not set', async () => {
      delete process.env.OPENAI_API_KEY;
      const mockClient = createMockOpenAI('Groceries');
      const client = new LLMClient(mockClient);

      const result = await client.classifyTransaction('Woolworths');
      expect(result).toBeNull();
    });

    it('returns null on network error', async () => {
      const mockClient = createErrorOpenAI(new Error('Network error'));
      const client = new LLMClient(mockClient);

      const result = await client.classifyTransaction('test');
      expect(result).toBeNull();
    });

    it('trims whitespace from response before matching', async () => {
      const mockClient = createMockOpenAI('  Transport  \n');
      const client = new LLMClient(mockClient);

      const result = await client.classifyTransaction('Uber ride');
      expect(result).toBe('Transport');
    });

    it('handles timeout (abort) gracefully', async () => {
      const mockClient = {
        chat: {
          completions: {
            create: vi.fn().mockImplementation(() => {
              const error = new Error('The operation was aborted');
              error.name = 'AbortError';
              return Promise.reject(error);
            }),
          },
        },
      } as any;

      const client = new LLMClient(mockClient);
      const result = await client.classifyTransaction('test');
      expect(result).toBeNull();
    });
  });

  describe('generateSummary', () => {
    const sampleInput: SummaryInput = {
      totalIncome: 5000,
      totalSpending: 3500,
      topCategories: [
        { name: 'Housing', amount: 1500 },
        { name: 'Groceries', amount: 800 },
        { name: 'Transport', amount: 400 },
      ],
      savingsProgress: { goal: 10000, current: 2500 },
      periodType: 'monthly',
    };

    it('sends correct system prompt for summary generation', async () => {
      const mockClient = createMockOpenAI('Your finances look good.');
      const client = new LLMClient(mockClient);

      await client.generateSummary(sampleInput);

      expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('plain-language summary'),
            }),
          ]),
        }),
        expect.any(Object)
      );
    });

    it('includes financial data in user message', async () => {
      const mockClient = createMockOpenAI('Summary text');
      const client = new LLMClient(mockClient);

      await client.generateSummary(sampleInput);

      const callArgs = mockClient.chat.completions.create.mock.calls[0][0];
      const userMessage = callArgs.messages[1].content;

      // Amounts are grouped the same way the app displays them, so the figures
      // the model echoes back match the ones on screen.
      expect(userMessage).toContain('₦5,000.00');
      expect(userMessage).toContain('₦3,500.00');
      expect(userMessage).toContain('Housing');
      expect(userMessage).toContain('Groceries');
      expect(userMessage).toContain('Transport');
      expect(userMessage).toContain('₦2,500.00');
      expect(userMessage).toContain('₦10,000.00');
      expect(userMessage).toContain('monthly');
    });

    it('returns LLM response on success', async () => {
      const mockClient = createMockOpenAI('This month you spent $3,500 of your $5,000 income.');
      const client = new LLMClient(mockClient);

      const result = await client.generateSummary(sampleInput);
      expect(result).toBe('This month you spent $3,500 of your $5,000 income.');
    });

    it('returns fallback string when API is unavailable', async () => {
      delete process.env.OPENAI_API_KEY;
      const mockClient = createMockOpenAI('unused');
      const client = new LLMClient(mockClient);

      const result = await client.generateSummary(sampleInput);
      expect(result).toContain('temporarily unavailable');
    });

    it('returns fallback string on error', async () => {
      const mockClient = createErrorOpenAI(new Error('Server error'));
      const client = new LLMClient(mockClient);

      const result = await client.generateSummary(sampleInput);
      expect(result).toContain('Unable to generate summary');
    });

    it('returns fallback string when response is null', async () => {
      const mockClient = createMockOpenAI(null);
      const client = new LLMClient(mockClient);

      const result = await client.generateSummary(sampleInput);
      expect(result).toContain('Unable to generate summary');
    });

    it('handles missing savingsProgress gracefully', async () => {
      const mockClient = createMockOpenAI('Summary without savings');
      const client = new LLMClient(mockClient);

      const input: SummaryInput = {
        totalIncome: 3000,
        totalSpending: 2500,
        topCategories: [{ name: 'Housing', amount: 1000 }],
        periodType: 'weekly',
      };

      const result = await client.generateSummary(input);
      expect(result).toBe('Summary without savings');
    });
  });

  describe('answerQuestion', () => {
    const sampleContext: FinancialContext = {
      transactions: [
        { category: 'Groceries', amount: 150, date: '2024-01-15', type: 'expense' as const },
        { category: 'Transport', amount: 50, date: '2024-01-16', type: 'expense' as const },
      ],
      budget: [
        { category: 'Groceries', budgeted: 400, actual: 150 },
        { category: 'Transport', budgeted: 200, actual: 50 },
      ],
      period: 'January 2024',
    };

    it('sends correct system prompt for Q&A', async () => {
      const mockClient = createMockOpenAI('You spent $150 on groceries.');
      const client = new LLMClient(mockClient);

      await client.answerQuestion('How much did I spend on groceries?', sampleContext);

      expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('financial data assistant'),
            }),
          ]),
        }),
        expect.any(Object)
      );
    });

    it('includes context data in user message', async () => {
      const mockClient = createMockOpenAI('Answer');
      const client = new LLMClient(mockClient);

      await client.answerQuestion('test question', sampleContext);

      const callArgs = mockClient.chat.completions.create.mock.calls[0][0];
      const userMessage = callArgs.messages[1].content;

      expect(userMessage).toContain('Groceries');
      expect(userMessage).toContain('150.00');
      expect(userMessage).toContain('Transport');
      expect(userMessage).toContain('January 2024');
      expect(userMessage).toContain('Budgeted ₦400.00');
      expect(userMessage).toContain('test question');
    });

    it('states every amount in Naira, never dollars', () => {
      // The app displays ₦ everywhere; prompts that said $ made the assistant
      // answer in the wrong currency.
      const mockClient = createMockOpenAI('Answer');
      const client = new LLMClient(mockClient);

      return client
        .answerQuestion('test question', sampleContext)
        .then(() => {
          const callArgs = mockClient.chat.completions.create.mock.calls[0][0];
          const systemPrompt = callArgs.messages[0].content;
          const userMessage = callArgs.messages[1].content;

          expect(userMessage).toContain('₦');
          expect(userMessage).not.toContain('$');
          expect(systemPrompt).toContain('Naira');
        });
    });

    it('returns LLM response on success', async () => {
      const mockClient = createMockOpenAI('You spent $150 on groceries this month.');
      const client = new LLMClient(mockClient);

      const result = await client.answerQuestion('How much on groceries?', sampleContext);
      expect(result).toBe('You spent $150 on groceries this month.');
    });

    it('returns fallback string when API is unavailable', async () => {
      delete process.env.OPENAI_API_KEY;
      const mockClient = createMockOpenAI('unused');
      const client = new LLMClient(mockClient);

      const result = await client.answerQuestion('test', sampleContext);
      expect(result).toContain('temporarily unavailable');
    });

    it('returns fallback string on error', async () => {
      const mockClient = createErrorOpenAI(new Error('Server error'));
      const client = new LLMClient(mockClient);

      const result = await client.answerQuestion('test', sampleContext);
      expect(result).toContain('Unable to answer');
    });

    it('handles context without budget', async () => {
      const mockClient = createMockOpenAI('Answer without budget');
      const client = new LLMClient(mockClient);

      const contextNoBudget: FinancialContext = {
        transactions: [{ category: 'Groceries', amount: 100, date: '2024-01-10', type: 'expense' as const }],
        period: 'January 2024',
      };

      const result = await client.answerQuestion('test', contextNoBudget);
      expect(result).toBe('Answer without budget');
    });
  });

  describe('retry behavior', () => {
    it('retries on 429 rate limit error with exponential backoff', async () => {
      vi.useFakeTimers();

      const rateLimitError = Object.assign(new Error('Rate limited'), { status: 429 });

      const mockCreate = vi.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Groceries' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        });

      const mockClient = { chat: { completions: { create: mockCreate } } } as any;
      const client = new LLMClient(mockClient);

      const resultPromise = client.classifyTransaction('Coles shop');

      // Advance through backoff delays
      await vi.advanceTimersByTimeAsync(1000); // 1st retry backoff
      await vi.advanceTimersByTimeAsync(2000); // 2nd retry backoff

      const result = await resultPromise;

      expect(result).toBe('Groceries');
      expect(mockCreate).toHaveBeenCalledTimes(3);

      vi.useRealTimers();
    });

    it('gives up after max retries on rate limit', async () => {
      vi.useFakeTimers();

      const rateLimitError = Object.assign(new Error('Rate limited'), { status: 429 });

      const mockCreate = vi.fn().mockRejectedValue(rateLimitError);

      const mockClient = { chat: { completions: { create: mockCreate } } } as any;
      const client = new LLMClient(mockClient);

      const resultPromise = client.classifyTransaction('test');

      // Advance through all backoff delays
      await vi.advanceTimersByTimeAsync(1000); // 1st retry backoff
      await vi.advanceTimersByTimeAsync(2000); // 2nd retry backoff
      await vi.advanceTimersByTimeAsync(4000); // 3rd retry backoff

      const result = await resultPromise;

      expect(result).toBeNull();
      // Initial attempt + 3 retries = 4 total calls
      expect(mockCreate).toHaveBeenCalledTimes(4);

      vi.useRealTimers();
    });

    it('does not retry on non-rate-limit errors', async () => {
      const serverError = Object.assign(new Error('Server error'), { status: 500 });

      const mockCreate = vi.fn().mockRejectedValue(serverError);

      const mockClient = { chat: { completions: { create: mockCreate } } } as any;
      const client = new LLMClient(mockClient);

      const result = await client.classifyTransaction('test');

      expect(result).toBeNull();
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe('token usage tracking', () => {
    it('logs token usage on successful response', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const mockClient = createMockOpenAI('Groceries', {
        prompt_tokens: 25,
        completion_tokens: 3,
        total_tokens: 28,
      });
      const client = new LLMClient(mockClient);

      await client.classifyTransaction('test');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('prompt: 25')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('completion: 3')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('total: 28')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('timeout handling', () => {
    it('passes an abort signal to the OpenAI client', async () => {
      const mockClient = createMockOpenAI('Groceries');
      const client = new LLMClient(mockClient);

      await client.classifyTransaction('test');

      expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        })
      );
    });
  });
});

describe('QA prompt separates income from spending', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalEnv;
  });

  it('labels a salary credit as income, not spending', async () => {
    const mockClient = createMockOpenAI('Answer');
    const client = new LLMClient(mockClient);

    await client.answerQuestion('Why am I over budget?', {
      period: 'August 2026',
      transactions: [
        { category: 'Other', amount: 450000, date: '2026-08-25', type: 'income' },
        { category: 'Housing', amount: 150000, date: '2026-08-01', type: 'expense' },
      ],
    });

    const userMessage =
      mockClient.chat.completions.create.mock.calls[0][0].messages[1].content;

    const incomeSection = userMessage.slice(
      userMessage.indexOf('Money received'),
      userMessage.indexOf('Money spent')
    );
    const spendSection = userMessage.slice(userMessage.indexOf('Money spent'));

    expect(incomeSection).toContain('₦450,000.00');
    expect(incomeSection).not.toContain('₦150,000.00');
    expect(spendSection).toContain('₦150,000.00');
    expect(spendSection).not.toContain('₦450,000.00');
  });

  it('states the two totals separately', async () => {
    const mockClient = createMockOpenAI('Answer');
    const client = new LLMClient(mockClient);

    await client.answerQuestion('How am I doing?', {
      period: 'August 2026',
      transactions: [
        { category: 'Other', amount: 450000, date: '2026-08-25', type: 'income' },
        { category: 'Housing', amount: 150000, date: '2026-08-01', type: 'expense' },
        { category: 'Dining', amount: 7800, date: '2026-08-04', type: 'expense' },
      ],
    });

    const userMessage =
      mockClient.chat.completions.create.mock.calls[0][0].messages[1].content;

    expect(userMessage).toContain('income, NOT spending');
    expect(userMessage).toContain('total ₦450,000.00');
    expect(userMessage).toContain('total ₦157,800.00');
  });

  it('omits the income section entirely when there is none', async () => {
    const mockClient = createMockOpenAI('Answer');
    const client = new LLMClient(mockClient);

    await client.answerQuestion('What did I spend?', {
      period: 'August 2026',
      transactions: [
        { category: 'Dining', amount: 7800, date: '2026-08-04', type: 'expense' },
      ],
    });

    const userMessage =
      mockClient.chat.completions.create.mock.calls[0][0].messages[1].content;

    expect(userMessage).not.toContain('Money received');
    expect(userMessage).toContain('Money spent');
  });
});
