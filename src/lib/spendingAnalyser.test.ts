import { describe, it, expect } from 'vitest';
import {
  getComparison,
  detectAnomalies,
  detectIncreasingCategories,
  generateExplanation,
  generateTrendExplanation,
  SpendingAnomaly,
  CategoryTrend,
} from './spendingAnalyser';
import { CategoryAllocation } from '@/models/budget';
import { Category } from '@/models/category';

describe('getComparison', () => {
  it('classifies category as over when actual exceeds budgeted', () => {
    const allocations: CategoryAllocation[] = [
      { category: 'Groceries', amount: 200, is_fixed: false },
    ];
    const actual = [{ category: 'Groceries' as Category, total: 250 }];

    const result = getComparison(allocations, actual);

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('over');
    expect(result[0].variance).toBe(50);
    expect(result[0].actual).toBe(250);
    expect(result[0].budgeted).toBe(200);
  });

  it('classifies category as on-track when actual is within 90-100% of budget', () => {
    const allocations: CategoryAllocation[] = [
      { category: 'Transport', amount: 100, is_fixed: false },
    ];
    const actual = [{ category: 'Transport' as Category, total: 95 }];

    const result = getComparison(allocations, actual);

    expect(result[0].status).toBe('on-track');
    expect(result[0].variance).toBe(-5);
  });

  it('classifies category as under when actual is below 90% of budget', () => {
    const allocations: CategoryAllocation[] = [
      { category: 'Entertainment', amount: 100, is_fixed: false },
    ];
    const actual = [{ category: 'Entertainment' as Category, total: 80 }];

    const result = getComparison(allocations, actual);

    expect(result[0].status).toBe('under');
    expect(result[0].variance).toBe(-20);
  });

  it('classifies as on-track when actual is exactly at budget', () => {
    const allocations: CategoryAllocation[] = [
      { category: 'Dining', amount: 150, is_fixed: false },
    ];
    const actual = [{ category: 'Dining' as Category, total: 150 }];

    const result = getComparison(allocations, actual);

    expect(result[0].status).toBe('on-track');
    expect(result[0].variance).toBe(0);
  });

  it('classifies as on-track when actual is exactly at 90% of budget', () => {
    const allocations: CategoryAllocation[] = [
      { category: 'Health', amount: 200, is_fixed: false },
    ];
    const actual = [{ category: 'Health' as Category, total: 180 }];

    const result = getComparison(allocations, actual);

    expect(result[0].status).toBe('on-track');
    expect(result[0].variance).toBe(-20);
  });

  it('classifies as under when actual is just below 90% of budget', () => {
    const allocations: CategoryAllocation[] = [
      { category: 'Shopping', amount: 200, is_fixed: false },
    ];
    const actual = [{ category: 'Shopping' as Category, total: 179.99 }];

    const result = getComparison(allocations, actual);

    expect(result[0].status).toBe('under');
  });

  it('treats missing actual spending as 0', () => {
    const allocations: CategoryAllocation[] = [
      { category: 'Utilities', amount: 100, is_fixed: true },
    ];
    const actual: { category: Category; total: number }[] = [];

    const result = getComparison(allocations, actual);

    expect(result[0].actual).toBe(0);
    expect(result[0].variance).toBe(-100);
    expect(result[0].status).toBe('under');
  });

  it('handles multiple categories correctly', () => {
    const allocations: CategoryAllocation[] = [
      { category: 'Groceries', amount: 300, is_fixed: false },
      { category: 'Transport', amount: 100, is_fixed: false },
      { category: 'Entertainment', amount: 50, is_fixed: false },
    ];
    const actual = [
      { category: 'Groceries' as Category, total: 350 },
      { category: 'Transport' as Category, total: 95 },
      { category: 'Entertainment' as Category, total: 20 },
    ];

    const result = getComparison(allocations, actual);

    expect(result[0].status).toBe('over');
    expect(result[1].status).toBe('on-track');
    expect(result[2].status).toBe('under');
  });
});

describe('detectAnomalies', () => {
  it('flags a transaction when amount > 2× category average with >= 3 prior transactions', () => {
    const transactions = [
      {
        id: 'tx1',
        amount: 500,
        category: 'Groceries' as Category,
        date: '2025-01-15',
        description: 'Big grocery haul',
      },
    ];
    const allTransactions = [
      { amount: 50, category: 'Groceries' as Category },
      { amount: 60, category: 'Groceries' as Category },
      { amount: 70, category: 'Groceries' as Category },
    ];

    const result = detectAnomalies(transactions, allTransactions);

    expect(result).toHaveLength(1);
    expect(result[0].transaction.id).toBe('tx1');
    expect(result[0].categoryAverage).toBe(60);
    expect(result[0].multiple).toBeCloseTo(500 / 60, 5);
  });

  it('does not flag when less than 3 prior transactions exist', () => {
    const transactions = [
      {
        id: 'tx1',
        amount: 500,
        category: 'Groceries' as Category,
        date: '2025-01-15',
        description: 'Big grocery haul',
      },
    ];
    const allTransactions = [
      { amount: 50, category: 'Groceries' as Category },
      { amount: 60, category: 'Groceries' as Category },
    ];

    const result = detectAnomalies(transactions, allTransactions);

    expect(result).toHaveLength(0);
  });

  it('does not flag when amount is exactly 2× the average', () => {
    const transactions = [
      {
        id: 'tx1',
        amount: 120,
        category: 'Dining' as Category,
        date: '2025-01-15',
        description: 'Fancy dinner',
      },
    ];
    const allTransactions = [
      { amount: 50, category: 'Dining' as Category },
      { amount: 60, category: 'Dining' as Category },
      { amount: 70, category: 'Dining' as Category },
    ];
    // Average = 60, 2× = 120, amount = 120 (not > 120)

    const result = detectAnomalies(transactions, allTransactions);

    expect(result).toHaveLength(0);
  });

  it('flags when amount is just above 2× the average', () => {
    const transactions = [
      {
        id: 'tx1',
        amount: 120.01,
        category: 'Dining' as Category,
        date: '2025-01-15',
        description: 'Fancy dinner',
      },
    ];
    const allTransactions = [
      { amount: 50, category: 'Dining' as Category },
      { amount: 60, category: 'Dining' as Category },
      { amount: 70, category: 'Dining' as Category },
    ];

    const result = detectAnomalies(transactions, allTransactions);

    expect(result).toHaveLength(1);
  });

  it('only considers transactions from the same category', () => {
    const transactions = [
      {
        id: 'tx1',
        amount: 200,
        category: 'Entertainment' as Category,
        date: '2025-01-15',
        description: 'Concert tickets',
      },
    ];
    const allTransactions = [
      { amount: 50, category: 'Groceries' as Category },
      { amount: 60, category: 'Groceries' as Category },
      { amount: 70, category: 'Groceries' as Category },
      { amount: 80, category: 'Entertainment' as Category },
      { amount: 90, category: 'Entertainment' as Category },
    ];
    // Only 2 Entertainment transactions — less than 3

    const result = detectAnomalies(transactions, allTransactions);

    expect(result).toHaveLength(0);
  });

  it('handles multiple anomalous transactions', () => {
    const transactions = [
      {
        id: 'tx1',
        amount: 500,
        category: 'Groceries' as Category,
        date: '2025-01-15',
        description: 'Bulk buy',
      },
      {
        id: 'tx2',
        amount: 300,
        category: 'Dining' as Category,
        date: '2025-01-16',
        description: 'Expensive restaurant',
      },
    ];
    const allTransactions = [
      { amount: 50, category: 'Groceries' as Category },
      { amount: 60, category: 'Groceries' as Category },
      { amount: 70, category: 'Groceries' as Category },
      { amount: 30, category: 'Dining' as Category },
      { amount: 40, category: 'Dining' as Category },
      { amount: 50, category: 'Dining' as Category },
    ];

    const result = detectAnomalies(transactions, allTransactions);

    expect(result).toHaveLength(2);
  });
});

describe('detectIncreasingCategories', () => {
  it('flags a category with more than 20% increase', () => {
    const current = [{ category: 'Groceries' as Category, total: 360 }];
    const previous = [{ category: 'Groceries' as Category, total: 300 }];
    // 20% increase = exactly at threshold (360/300 = 1.2)
    // But we need > 20%, so let's use a value that clearly exceeds

    const result = detectIncreasingCategories(
      [{ category: 'Groceries', total: 361 }],
      previous
    );

    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('Groceries');
    expect(result[0].previousAmount).toBe(300);
    expect(result[0].currentAmount).toBe(361);
    expect(result[0].percentageChange).toBeCloseTo(20.33, 1);
  });

  it('does not flag a category with exactly 20% increase', () => {
    const current = [{ category: 'Transport' as Category, total: 120 }];
    const previous = [{ category: 'Transport' as Category, total: 100 }];

    const result = detectIncreasingCategories(current, previous);

    expect(result).toHaveLength(0);
  });

  it('does not flag a category with less than 20% increase', () => {
    const current = [{ category: 'Utilities' as Category, total: 110 }];
    const previous = [{ category: 'Utilities' as Category, total: 100 }];

    const result = detectIncreasingCategories(current, previous);

    expect(result).toHaveLength(0);
  });

  it('does not flag a category where spending decreased', () => {
    const current = [{ category: 'Shopping' as Category, total: 80 }];
    const previous = [{ category: 'Shopping' as Category, total: 100 }];

    const result = detectIncreasingCategories(current, previous);

    expect(result).toHaveLength(0);
  });

  it('skips categories with no previous data', () => {
    const current = [{ category: 'Health' as Category, total: 200 }];
    const previous: { category: Category; total: number }[] = [];

    const result = detectIncreasingCategories(current, previous);

    expect(result).toHaveLength(0);
  });

  it('skips categories where previous total is 0', () => {
    const current = [{ category: 'Subscriptions' as Category, total: 50 }];
    const previous = [{ category: 'Subscriptions' as Category, total: 0 }];

    const result = detectIncreasingCategories(current, previous);

    expect(result).toHaveLength(0);
  });

  it('detects multiple increasing categories', () => {
    const current = [
      { category: 'Groceries' as Category, total: 400 },
      { category: 'Dining' as Category, total: 200 },
      { category: 'Transport' as Category, total: 90 },
    ];
    const previous = [
      { category: 'Groceries' as Category, total: 300 },
      { category: 'Dining' as Category, total: 100 },
      { category: 'Transport' as Category, total: 100 },
    ];

    const result = detectIncreasingCategories(current, previous);

    expect(result).toHaveLength(2);
    expect(result.map((t) => t.category)).toContain('Groceries');
    expect(result.map((t) => t.category)).toContain('Dining');
  });
});

describe('generateExplanation', () => {
  it('produces a well-formed explanation string', () => {
    const anomaly: SpendingAnomaly = {
      transaction: {
        id: 'tx1',
        amount: 500,
        category: 'Groceries',
        date: '2025-01-15',
        description: 'Bulk grocery purchase',
      },
      categoryAverage: 60,
      multiple: 500 / 60,
    };

    const explanation = generateExplanation(anomaly);

    expect(explanation).toBe(
      'This Bulk grocery purchase of 500.00 is 8.3× the average Groceries transaction of 60.00'
    );
  });

  it('handles single-digit multiple correctly', () => {
    const anomaly: SpendingAnomaly = {
      transaction: {
        id: 'tx2',
        amount: 150,
        category: 'Dining',
        date: '2025-02-01',
        description: 'Fancy restaurant',
      },
      categoryAverage: 50,
      multiple: 3.0,
    };

    const explanation = generateExplanation(anomaly);

    expect(explanation).toBe(
      'This Fancy restaurant of 150.00 is 3.0× the average Dining transaction of 50.00'
    );
  });
});

describe('generateTrendExplanation', () => {
  it('produces a well-formed trend explanation string', () => {
    const trend: CategoryTrend = {
      category: 'Groceries',
      previousAmount: 300,
      currentAmount: 400,
      percentageChange: 33.33,
    };

    const explanation = generateTrendExplanation(trend);

    expect(explanation).toBe(
      'Groceries spending increased by 33% from 300.00 to 400.00'
    );
  });

  it('rounds percentage to nearest whole number', () => {
    const trend: CategoryTrend = {
      category: 'Transport',
      previousAmount: 100,
      currentAmount: 125,
      percentageChange: 25,
    };

    const explanation = generateTrendExplanation(trend);

    expect(explanation).toBe(
      'Transport spending increased by 25% from 100.00 to 125.00'
    );
  });
});
