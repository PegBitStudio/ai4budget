import { describe, it, expect, vi } from 'vitest';
import {
  buildSummaryData,
  generatePlainTextSummary,
  generateSummary,
  SummaryParams,
  SummaryData,
} from './summaryGenerator';
import { Category } from '@/models/category';

// --- Test data helpers ---

function makeSummaryParams(overrides?: Partial<SummaryParams>): SummaryParams {
  return {
    income: [
      { amount: 5000, date: '2024-01-01' },
      { amount: 1000, date: '2024-01-15' },
    ],
    expenses: [
      { amount: 1200, category: 'Housing' as Category, date: '2024-01-05' },
      { amount: 800, category: 'Groceries' as Category, date: '2024-01-07' },
      { amount: 500, category: 'Transport' as Category, date: '2024-01-10' },
      { amount: 300, category: 'Entertainment' as Category, date: '2024-01-12' },
      { amount: 200, category: 'Dining' as Category, date: '2024-01-14' },
    ],
    budget: [
      { category: 'Housing' as Category, amount: 1500 },
      { category: 'Groceries' as Category, amount: 900 },
      { category: 'Transport' as Category, amount: 600 },
      { category: 'Entertainment' as Category, amount: 400 },
      { category: 'Dining' as Category, amount: 300 },
    ],
    savingsGoal: { target: 10000, current: 2500 },
    periodType: 'monthly',
    periodLabel: 'January 2024',
    ...overrides,
  };
}

// --- buildSummaryData tests ---

describe('buildSummaryData', () => {
  it('correctly aggregates total income', () => {
    const params = makeSummaryParams();
    const result = buildSummaryData(params);
    expect(result.totalIncome).toBe(6000);
  });

  it('correctly aggregates total spending', () => {
    const params = makeSummaryParams();
    const result = buildSummaryData(params);
    expect(result.totalSpending).toBe(3000);
  });

  it('identifies top 3 categories sorted by amount descending', () => {
    const params = makeSummaryParams();
    const result = buildSummaryData(params);

    expect(result.topCategories).toHaveLength(3);
    expect(result.topCategories[0]).toEqual({ name: 'Housing', amount: 1200 });
    expect(result.topCategories[1]).toEqual({ name: 'Groceries', amount: 800 });
    expect(result.topCategories[2]).toEqual({ name: 'Transport', amount: 500 });
  });

  it('returns fewer than 3 categories when fewer exist', () => {
    const params = makeSummaryParams({
      expenses: [
        { amount: 500, category: 'Housing' as Category, date: '2024-01-05' },
        { amount: 300, category: 'Housing' as Category, date: '2024-01-10' },
      ],
    });
    const result = buildSummaryData(params);

    expect(result.topCategories).toHaveLength(1);
    expect(result.topCategories[0]).toEqual({ name: 'Housing', amount: 800 });
  });

  it('correctly aggregates multiple expenses in the same category', () => {
    const params = makeSummaryParams({
      expenses: [
        { amount: 400, category: 'Groceries' as Category, date: '2024-01-01' },
        { amount: 350, category: 'Groceries' as Category, date: '2024-01-08' },
        { amount: 200, category: 'Transport' as Category, date: '2024-01-03' },
      ],
    });
    const result = buildSummaryData(params);

    expect(result.topCategories[0]).toEqual({ name: 'Groceries', amount: 750 });
    expect(result.topCategories[1]).toEqual({ name: 'Transport', amount: 200 });
  });

  it('sets isOnTrack to true when spending is within budget', () => {
    const params = makeSummaryParams(); // spending 3000, budget 3700
    const result = buildSummaryData(params);
    expect(result.isOnTrack).toBe(true);
  });

  it('sets isOnTrack to false when spending exceeds budget', () => {
    const params = makeSummaryParams({
      budget: [
        { category: 'Housing' as Category, amount: 500 },
        { category: 'Groceries' as Category, amount: 400 },
      ],
    });
    const result = buildSummaryData(params);
    // Total budgeted = 900, spending = 3000
    expect(result.isOnTrack).toBe(false);
  });

  it('sets isOnTrack to true when spending equals budget exactly', () => {
    const params = makeSummaryParams({
      expenses: [
        { amount: 1000, category: 'Housing' as Category, date: '2024-01-05' },
      ],
      budget: [{ category: 'Housing' as Category, amount: 1000 }],
    });
    const result = buildSummaryData(params);
    expect(result.isOnTrack).toBe(true);
  });

  it('defaults isOnTrack to true when no budget exists', () => {
    const params = makeSummaryParams({ budget: undefined });
    const result = buildSummaryData(params);
    expect(result.isOnTrack).toBe(true);
    expect(result.totalBudgeted).toBe(0);
  });

  it('includes savings progress when savingsGoal is provided', () => {
    const params = makeSummaryParams();
    const result = buildSummaryData(params);
    expect(result.savingsProgress).toEqual({ goal: 10000, current: 2500 });
  });

  it('handles missing savings goal gracefully', () => {
    const params = makeSummaryParams({ savingsGoal: undefined });
    const result = buildSummaryData(params);
    expect(result.savingsProgress).toBeUndefined();
  });

  it('handles insufficient data (no transactions)', () => {
    const params = makeSummaryParams({ income: [], expenses: [] });
    const result = buildSummaryData(params);

    expect(result.hasData).toBe(false);
    expect(result.totalIncome).toBe(0);
    expect(result.totalSpending).toBe(0);
    expect(result.topCategories).toHaveLength(0);
  });

  it('sets hasData to true when only income exists', () => {
    const params = makeSummaryParams({ expenses: [] });
    const result = buildSummaryData(params);
    expect(result.hasData).toBe(true);
  });

  it('preserves periodType and periodLabel', () => {
    const params = makeSummaryParams({ periodType: 'weekly', periodLabel: 'Week 4' });
    const result = buildSummaryData(params);
    expect(result.periodType).toBe('weekly');
    expect(result.periodLabel).toBe('Week 4');
  });
});

// --- generatePlainTextSummary tests ---

describe('generatePlainTextSummary', () => {
  it('produces readable output with income and spending', () => {
    const data: SummaryData = {
      totalIncome: 6000,
      totalSpending: 3000,
      topCategories: [
        { name: 'Housing', amount: 1200 },
        { name: 'Groceries', amount: 800 },
        { name: 'Transport', amount: 500 },
      ],
      savingsProgress: { goal: 10000, current: 2500 },
      isOnTrack: true,
      totalBudgeted: 3700,
      periodType: 'monthly',
      periodLabel: 'January 2024',
      hasData: true,
    };

    const summary = generatePlainTextSummary(data);

    expect(summary).toContain('This month');
    expect(summary).toContain('earned');
    expect(summary).toContain('spent');
    expect(summary).toContain('Housing');
    expect(summary).toContain('Groceries');
    expect(summary).toContain('Transport');
    expect(summary).toContain('on track');
    expect(summary).toContain('saved');
    expect(summary).toContain('target');
  });

  it('uses "week" for weekly period type', () => {
    const data: SummaryData = {
      totalIncome: 1500,
      totalSpending: 800,
      topCategories: [{ name: 'Groceries', amount: 400 }],
      isOnTrack: true,
      totalBudgeted: 1000,
      periodType: 'weekly',
      periodLabel: 'Week 5',
      hasData: true,
    };

    const summary = generatePlainTextSummary(data);
    expect(summary).toContain('This week');
  });

  it('shows over budget status', () => {
    const data: SummaryData = {
      totalIncome: 3000,
      totalSpending: 3500,
      topCategories: [{ name: 'Shopping', amount: 2000 }],
      isOnTrack: false,
      totalBudgeted: 3000,
      periodType: 'monthly',
      periodLabel: 'Feb 2024',
      hasData: true,
    };

    const summary = generatePlainTextSummary(data);
    expect(summary).toContain('over budget');
  });

  it('handles insufficient data (no transactions)', () => {
    const data: SummaryData = {
      totalIncome: 0,
      totalSpending: 0,
      topCategories: [],
      isOnTrack: true,
      totalBudgeted: 0,
      periodType: 'monthly',
      periodLabel: 'March 2024',
      hasData: false,
    };

    const summary = generatePlainTextSummary(data);
    expect(summary).toContain('not enough data');
    expect(summary).toContain('income');
    expect(summary).toContain('expense');
  });

  it('omits budget status when no budget exists', () => {
    const data: SummaryData = {
      totalIncome: 4000,
      totalSpending: 2000,
      topCategories: [{ name: 'Dining', amount: 800 }],
      isOnTrack: true,
      totalBudgeted: 0,
      periodType: 'monthly',
      periodLabel: 'April 2024',
      hasData: true,
    };

    const summary = generatePlainTextSummary(data);
    expect(summary).not.toContain('on track');
    expect(summary).not.toContain('over budget');
  });

  it('omits savings progress when no savings goal', () => {
    const data: SummaryData = {
      totalIncome: 4000,
      totalSpending: 2000,
      topCategories: [{ name: 'Dining', amount: 800 }],
      isOnTrack: true,
      totalBudgeted: 3000,
      periodType: 'monthly',
      periodLabel: 'May 2024',
      hasData: true,
    };

    const summary = generatePlainTextSummary(data);
    expect(summary).not.toContain('saved');
    expect(summary).not.toContain('target');
  });

  it('contains no jargon or abbreviations', () => {
    const data: SummaryData = {
      totalIncome: 6000,
      totalSpending: 3000,
      topCategories: [
        { name: 'Housing', amount: 1200 },
        { name: 'Groceries', amount: 800 },
        { name: 'Transport', amount: 500 },
      ],
      savingsProgress: { goal: 10000, current: 2500 },
      isOnTrack: true,
      totalBudgeted: 3700,
      periodType: 'monthly',
      periodLabel: 'January 2024',
      hasData: true,
    };

    const summary = generatePlainTextSummary(data);

    // Should not contain common financial abbreviations or jargon
    expect(summary).not.toMatch(/\bYTD\b/);
    expect(summary).not.toMatch(/\bROI\b/);
    expect(summary).not.toMatch(/\bP&L\b/);
    expect(summary).not.toMatch(/\bAPR\b/);
    expect(summary).not.toMatch(/\bMTD\b/);
  });
});

// --- generateSummary tests ---

describe('generateSummary', () => {
  const validData: SummaryData = {
    totalIncome: 6000,
    totalSpending: 3000,
    topCategories: [
      { name: 'Housing', amount: 1200 },
      { name: 'Groceries', amount: 800 },
      { name: 'Transport', amount: 500 },
    ],
    savingsProgress: { goal: 10000, current: 2500 },
    isOnTrack: true,
    totalBudgeted: 3700,
    periodType: 'monthly',
    periodLabel: 'January 2024',
    hasData: true,
  };

  it('returns insufficient data message when hasData is false', async () => {
    const noData: SummaryData = { ...validData, hasData: false };
    const result = await generateSummary(noData, true);
    expect(result).toContain('not enough data');
  });

  it('uses LLM when useLLM is true and client is provided', async () => {
    const mockClient = {
      generateSummary: vi.fn().mockResolvedValue('LLM generated summary'),
    };

    const result = await generateSummary(validData, true, mockClient);
    expect(result).toBe('LLM generated summary');
    expect(mockClient.generateSummary).toHaveBeenCalledOnce();
  });

  it('passes correct input to LLM client', async () => {
    const mockClient = {
      generateSummary: vi.fn().mockResolvedValue('summary'),
    };

    await generateSummary(validData, true, mockClient);

    expect(mockClient.generateSummary).toHaveBeenCalledWith(
      {
        totalIncome: 6000,
        totalSpending: 3000,
        topCategories: [
          { name: 'Housing', amount: 1200 },
          { name: 'Groceries', amount: 800 },
          { name: 'Transport', amount: 500 },
        ],
        savingsProgress: { goal: 10000, current: 2500 },
        periodType: 'monthly',
      },
      // The account's currency travels with the data, so the model names the
      // money the user actually keeps their books in. Undefined here because
      // this caller did not pass one, which is the Naira default.
      undefined
    );
  });

  it('hands the account currency to the model', async () => {
    const mockClient = { generateSummary: vi.fn().mockResolvedValue('summary') };
    const euro = { llmName: 'Euros', symbol: '€' };

    await generateSummary(validData, true, mockClient, euro);

    expect(mockClient.generateSummary).toHaveBeenCalledWith(
      expect.anything(),
      euro
    );
  });

  it('writes the fallback summary in the account currency', async () => {
    const result = await generateSummary(validData, false, undefined, {
      llmName: 'Euros',
      symbol: '€',
    });
    expect(result).toContain('€');
    expect(result).not.toContain('₦');
  });

  it('falls back to plain text when useLLM is false', async () => {
    const result = await generateSummary(validData, false);
    expect(result).toContain('This month');
    expect(result).toContain('earned');
  });

  it('falls back to plain text when LLM client is not provided', async () => {
    const result = await generateSummary(validData, true);
    expect(result).toContain('This month');
    expect(result).toContain('earned');
  });

  it('falls back to plain text when LLM client throws an error', async () => {
    const mockClient = {
      generateSummary: vi.fn().mockRejectedValue(new Error('API timeout')),
    };

    const result = await generateSummary(validData, true, mockClient);
    expect(result).toContain('This month');
    expect(result).toContain('earned');
  });
});
