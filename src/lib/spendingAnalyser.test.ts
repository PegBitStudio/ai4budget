import { describe, it, expect } from 'vitest';
import {
  getComparison,
  detectAnomalies,
  detectIncreasingCategories,
  generateExplanation,
  generateTrendExplanation,
  SpendingAnomaly,
  HistoricTransaction,
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
  /** Three months of an ordinary, repeating grocery habit. */
  const groceryHistory: HistoricTransaction[] = [
    { amount: 9500, category: 'Groceries', description: 'Mile 12 market', date: '2026-06-09' },
    { amount: 11000, category: 'Groceries', description: 'Mile 12 market', date: '2026-07-09' },
    { amount: 9500, category: 'Groceries', description: 'Mile 12 market', date: '2026-08-09' },
    { amount: 14500, category: 'Groceries', description: 'Shoprite top-up', date: '2026-06-16' },
    { amount: 14500, category: 'Groceries', description: 'Shoprite top-up', date: '2026-07-16' },
    { amount: 14500, category: 'Groceries', description: 'Shoprite top-up', date: '2026-08-16' },
  ];

  it('flags a one-off purchase far above the category median', () => {
    const result = detectAnomalies(
      [
        {
          id: 'tx1',
          amount: 90000,
          category: 'Groceries',
          date: '2026-08-20',
          description: 'Party supplies for owambe',
        },
      ],
      groceryHistory
    );

    expect(result).toHaveLength(1);
    expect(result[0].transaction.id).toBe('tx1');
    expect(result[0].categoryAverage).toBe(12750); // median of the six
  });

  it('does not flag a recurring charge, however large', () => {
    // The gym membership is the same amount every month. It is a commitment,
    // not a surprise, and flagging it makes the whole feature untrustworthy.
    const history: HistoricTransaction[] = [
      { amount: 2500, category: 'Subscriptions', description: 'Spotify', date: '2026-06-07' },
      { amount: 2500, category: 'Subscriptions', description: 'Spotify', date: '2026-07-07' },
      { amount: 2500, category: 'Subscriptions', description: 'Spotify', date: '2026-08-07' },
      { amount: 25000, category: 'Subscriptions', description: 'Gym membership', date: '2026-06-12' },
      { amount: 25000, category: 'Subscriptions', description: 'Gym membership', date: '2026-07-12' },
      { amount: 25000, category: 'Subscriptions', description: 'Gym membership', date: '2026-08-12' },
    ];

    const result = detectAnomalies(
      [
        {
          id: 'gym',
          amount: 25000,
          category: 'Subscriptions',
          date: '2026-08-12',
          description: 'Gym membership',
        },
      ],
      history
    );

    expect(result).toEqual([]);
  });

  it('matches a recurring merchant despite formatting differences', () => {
    const history: HistoricTransaction[] = [
      { amount: 25000, category: 'Subscriptions', description: 'Gym membership - i-Fitness', date: '2026-06-12' },
      { amount: 25000, category: 'Subscriptions', description: 'GYM MEMBERSHIP I FITNESS', date: '2026-07-12' },
      { amount: 2500, category: 'Subscriptions', description: 'Spotify', date: '2026-07-07' },
      { amount: 2500, category: 'Subscriptions', description: 'Spotify', date: '2026-08-07' },
    ];

    const result = detectAnomalies(
      [
        {
          id: 'gym',
          amount: 25000,
          category: 'Subscriptions',
          date: '2026-08-12',
          description: 'gym membership ifitness',
        },
      ],
      history
    );

    expect(result).toEqual([]);
  });

  it('still flags a charge seen only once before', () => {
    // One prior month is not enough to call something recurring.
    const history: HistoricTransaction[] = [
      ...groceryHistory,
      { amount: 90000, category: 'Groceries', description: 'Party supplies', date: '2026-08-20' },
    ];

    const result = detectAnomalies(
      [
        {
          id: 'tx1',
          amount: 90000,
          category: 'Groceries',
          date: '2026-08-20',
          description: 'Party supplies',
        },
      ],
      history
    );

    expect(result).toHaveLength(1);
  });

  it('uses the median so one huge purchase cannot hide behind its own average', () => {
    // The mean of these is 82,875 — the phone is only 3.4x that, and every
    // ordinary purchase gets dragged up with it. The median is 15,500, which
    // is what this person actually spends on Shopping.
    const history: HistoricTransaction[] = [
      { amount: 15500, category: 'Shopping', description: 'Jumia items', date: '2026-06-19' },
      { amount: 15500, category: 'Shopping', description: 'Jumia items', date: '2026-07-19' },
      { amount: 15500, category: 'Shopping', description: 'Jumia items', date: '2026-08-19' },
      { amount: 285000, category: 'Shopping', description: 'Slot - replacement phone', date: '2026-08-22' },
    ];

    const result = detectAnomalies(
      [
        {
          id: 'phone',
          amount: 285000,
          category: 'Shopping',
          date: '2026-08-22',
          description: 'Slot - replacement phone',
        },
      ],
      history
    );

    expect(result).toHaveLength(1);
    expect(result[0].categoryAverage).toBe(15500);
    expect(result[0].multiple).toBeCloseTo(18.4, 1);
  });

  it('does not flag a category with too little history to judge', () => {
    const result = detectAnomalies(
      [
        {
          id: 'tx1',
          amount: 200000,
          category: 'Entertainment',
          date: '2026-08-15',
          description: 'Concert tickets',
        },
      ],
      [
        { amount: 6500, category: 'Entertainment', description: 'Cinema', date: '2026-06-25' },
        { amount: 6500, category: 'Entertainment', description: 'Cinema b', date: '2026-07-25' },
      ]
    );

    expect(result).toEqual([]);
  });

  it('compares only against the same category', () => {
    const result = detectAnomalies(
      [
        {
          id: 'tx1',
          amount: 30000,
          category: 'Entertainment',
          date: '2026-08-15',
          description: 'Concert tickets',
        },
      ],
      groceryHistory
    );

    expect(result).toEqual([]);
  });

  it('does not flag a purchase at exactly twice the median', () => {
    const result = detectAnomalies(
      [
        {
          id: 'tx1',
          amount: 25500,
          category: 'Groceries',
          date: '2026-08-20',
          description: 'Double shop',
        },
      ],
      groceryHistory
    );

    expect(result).toEqual([]);
  });

  it('returns the worst offender first', () => {
    const history: HistoricTransaction[] = [
      ...groceryHistory,
      { amount: 4800, category: 'Dining', description: 'Lunch a', date: '2026-06-04' },
      { amount: 4800, category: 'Dining', description: 'Lunch b', date: '2026-07-04' },
      { amount: 6000, category: 'Dining', description: 'Lunch c', date: '2026-08-04' },
    ];

    const result = detectAnomalies(
      [
        {
          id: 'dining',
          amount: 20000,
          category: 'Dining',
          date: '2026-08-21',
          description: 'Birthday dinner',
        },
        {
          id: 'grocery',
          amount: 120000,
          category: 'Groceries',
          date: '2026-08-20',
          description: 'Party supplies',
        },
      ],
      history
    );

    expect(result.map((a) => a.transaction.id)).toEqual(['grocery', 'dining']);
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
      '8.3× your usual Groceries spend of ₦60.00'
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
      '3.0× your usual Dining spend of ₦50.00'
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
      'Groceries spending increased by 33% from ₦300.00 to ₦400.00'
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
      'Transport spending increased by 25% from ₦100.00 to ₦125.00'
    );
  });
});
