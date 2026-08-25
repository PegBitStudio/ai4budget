import { describe, it, expect, vi } from 'vitest';
import {
  answerQuestion,
  isFinancialQuestion,
  getLocalAnswer,
  buildContext,
  QAParams,
  QAData,
} from './qaEngine';

const sampleTransactions = [
  { amount: 50, category: 'Groceries', date: '2024-01-15', type: 'expense' },
  { amount: 30, category: 'Groceries', date: '2024-01-20', type: 'expense' },
  { amount: 100, category: 'Dining', date: '2024-01-10', type: 'expense' },
  { amount: 3000, category: 'Salary', date: '2024-01-01', type: 'income' },
  { amount: 500, category: 'Freelance', date: '2024-01-15', type: 'income' },
];

const sampleBudget = [
  { category: 'Groceries', budgeted: 200, actual: 80 },
  { category: 'Dining', budgeted: 150, actual: 100 },
  { category: 'Transport', budgeted: 100, actual: 60 },
];

describe('qaEngine', () => {
  describe('isFinancialQuestion', () => {
    it('returns true for questions about spending', () => {
      expect(isFinancialQuestion('How much did I spend on groceries?')).toBe(true);
    });

    it('returns true for questions about budget', () => {
      expect(isFinancialQuestion('Am I over budget this month?')).toBe(true);
    });

    it('returns true for questions about income', () => {
      expect(isFinancialQuestion('What is my income?')).toBe(true);
    });

    it('returns true for questions about savings', () => {
      expect(isFinancialQuestion('How much have I saved?')).toBe(true);
    });

    it('returns false for off-topic questions', () => {
      expect(isFinancialQuestion("what's the weather today?")).toBe(false);
    });

    it('returns false for unrelated questions', () => {
      expect(isFinancialQuestion('Who won the game last night?')).toBe(false);
    });
  });

  describe('getLocalAnswer', () => {
    const data: QAData = {
      transactions: sampleTransactions,
      budget: sampleBudget,
    };

    it('answers "how much did I spend on groceries"', () => {
      const answer = getLocalAnswer('how much did I spend on groceries?', data);
      expect(answer).not.toBeNull();
      expect(answer).toContain('$80.00');
      expect(answer).toContain('Groceries');
    });

    it('answers "what is my total spending"', () => {
      const answer = getLocalAnswer('what is my total spending?', data);
      expect(answer).not.toBeNull();
      expect(answer).toContain('$180.00');
    });

    it('answers "what is my income"', () => {
      const answer = getLocalAnswer('what is my income?', data);
      expect(answer).not.toBeNull();
      expect(answer).toContain('$3500.00');
    });

    it('returns null for complex questions that need LLM', () => {
      const answer = getLocalAnswer(
        'which category increased the most compared to last month?',
        data
      );
      expect(answer).toBeNull();
    });

    it('reports zero spending for category with no transactions', () => {
      const answer = getLocalAnswer('how much did I spend on transport?', data);
      expect(answer).not.toBeNull();
      expect(answer).toContain("haven't spent anything");
    });
  });

  describe('buildContext', () => {
    it('builds context with limited transactions', () => {
      const context = buildContext({
        transactions: sampleTransactions,
        budget: sampleBudget,
        period: 'January 2024',
      });

      expect(context.period).toBe('January 2024');
      expect(context.budget).toEqual(sampleBudget);
      expect(context.transactions).toHaveLength(5);
      // `type` must reach the assistant. Dropping it made a salary credit
      // indistinguishable from a large purchase, and the assistant duly
      // blamed the user's income for their overspending.
      expect(context.transactions[0]).toEqual({
        category: 'Groceries',
        amount: 50,
        date: '2024-01-15',
        type: 'expense',
      });
    });

    it('carries income through as income', () => {
      const context = buildContext({
        transactions: [
          { amount: 450000, category: 'Other', date: '2024-01-25', type: 'income' },
        ],
        period: 'January 2024',
      });

      expect(context.transactions[0].type).toBe('income');
    });

    it('limits transactions to 50', () => {
      const manyTransactions = Array.from({ length: 100 }, (_, i) => ({
        amount: 10,
        category: 'Groceries',
        date: `2024-01-${String(i % 28 + 1).padStart(2, '0')}`,
        type: 'expense',
      }));

      const context = buildContext({
        transactions: manyTransactions,
        period: 'January 2024',
      });

      expect(context.transactions).toHaveLength(50);
    });
  });

  describe('answerQuestion', () => {
    it('returns local answer for category spending question', async () => {
      const result = await answerQuestion({
        question: 'how much did I spend on groceries?',
        transactions: sampleTransactions,
        budget: sampleBudget,
        period: 'January 2024',
      });

      expect(result.source).toBe('local');
      expect(result.answer).toContain('$80.00');
    });

    it('returns local answer for total spending question', async () => {
      const result = await answerQuestion({
        question: 'what is my total spending?',
        transactions: sampleTransactions,
        period: 'January 2024',
      });

      expect(result.source).toBe('local');
      expect(result.answer).toContain('$180.00');
    });

    it('returns local answer for income question', async () => {
      const result = await answerQuestion({
        question: 'what is my income?',
        transactions: sampleTransactions,
        period: 'January 2024',
      });

      expect(result.source).toBe('local');
      expect(result.answer).toContain('$3500.00');
    });

    it('falls through to LLM for complex questions', async () => {
      const mockLlmClient = {
        answerQuestion: vi.fn().mockResolvedValue('Based on your data, dining increased by 15% compared to last month.'),
      };

      const result = await answerQuestion({
        question: 'which category has increased the most?',
        transactions: sampleTransactions,
        budget: sampleBudget,
        period: 'January 2024',
        llmClient: mockLlmClient,
      });

      expect(result.source).toBe('llm');
      expect(result.answer).toContain('dining increased');
      expect(mockLlmClient.answerQuestion).toHaveBeenCalledTimes(1);
    });

    it('returns error message when no data available', async () => {
      const result = await answerQuestion({
        question: 'how much did I spend on groceries?',
        transactions: [],
        period: 'January 2024',
      });

      expect(result.source).toBe('error');
      expect(result.answer).toContain('not enough financial data');
    });

    it('returns appropriate message for off-topic questions', async () => {
      const result = await answerQuestion({
        question: "what's the weather like today?",
        transactions: sampleTransactions,
        period: 'January 2024',
      });

      expect(result.source).toBe('error');
      expect(result.answer).toContain('can only answer questions about your financial data');
    });

    it('returns error for empty question', async () => {
      const result = await answerQuestion({
        question: '',
        transactions: sampleTransactions,
        period: 'January 2024',
      });

      expect(result.source).toBe('error');
      expect(result.answer).toContain('Please ask a question');
    });

    it('handles LLM error gracefully', async () => {
      const mockLlmClient = {
        answerQuestion: vi.fn().mockRejectedValue(new Error('API timeout')),
      };

      const result = await answerQuestion({
        question: 'compare my spending across categories',
        transactions: sampleTransactions,
        budget: sampleBudget,
        period: 'January 2024',
        llmClient: mockLlmClient,
      });

      expect(result.source).toBe('error');
      expect(result.answer).toContain('Unable to process');
    });

    it('returns clarification hint when no LLM and cannot answer locally', async () => {
      const result = await answerQuestion({
        question: 'compare my spending across categories',
        transactions: sampleTransactions,
        budget: sampleBudget,
        period: 'January 2024',
        // no llmClient provided
      });

      expect(result.source).toBe('error');
      expect(result.needsClarification).toBe(true);
    });
  });
});

describe('advice-shaped questions', () => {
  // "What should I cut first?" contains no keyword from the list, and the old
  // gate refused it outright — including the app's own suggested questions.
  const adviceQuestions = [
    'What should I cut first?',
    'Where is all my money going?',
    'Can I afford a new phone this month?',
    'Am I on track?',
    'How much do I have left?',
  ];

  it.each(adviceQuestions)('sends "%s" to the assistant rather than refusing', async (question) => {
    const llmClient = {
      answerQuestion: vi.fn().mockResolvedValue('Cut Dining first.'),
    };

    const result = await answerQuestion({
      question,
      transactions: sampleTransactions,
      period: 'August 2026',
      llmClient,
    });

    expect(result.source).not.toBe('error');
    expect(llmClient.answerQuestion).toHaveBeenCalled();
  });

  it('still refuses an off-topic question when no assistant is available', async () => {
    const result = await answerQuestion({
      question: "What's the weather today?",
      transactions: sampleTransactions,
      period: 'August 2026',
    });

    expect(result.source).toBe('error');
    expect(result.answer).toContain('only answer questions about your financial data');
  });

  it('leaves an off-topic question for the assistant to decline', async () => {
    // The model's system prompt instructs it to decline; that is a better
    // judge of topic than a keyword list.
    const llmClient = {
      answerQuestion: vi
        .fn()
        .mockResolvedValue('I can only help with questions about your finances.'),
    };

    const result = await answerQuestion({
      question: 'Who won the game last night?',
      transactions: sampleTransactions,
      period: 'August 2026',
      llmClient,
    });

    expect(llmClient.answerQuestion).toHaveBeenCalled();
    expect(result.answer).toContain('only help with questions about your finances');
  });
});
