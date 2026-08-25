import { describe, it, expect } from 'vitest';
import {
  generateBudget,
  modifyAllocation,
  normalizeToMonthly,
  normalizeToWeekly,
  BudgetGenerationParams,
} from './budgetEngine';
import { NEEDS_CATEGORIES, WANTS_CATEGORIES } from '@/config/categories';
import { Category } from '@/models/category';

describe('normalizeToMonthly', () => {
  it('returns amount unchanged for monthly frequency', () => {
    expect(normalizeToMonthly(100, 'monthly')).toBe(100);
  });

  it('multiplies weekly amount by 4.33', () => {
    expect(normalizeToMonthly(100, 'weekly')).toBeCloseTo(433, 0);
  });

  it('multiplies fortnightly amount by 2.17', () => {
    expect(normalizeToMonthly(100, 'fortnightly')).toBeCloseTo(217, 0);
  });

  it('divides yearly amount by 12', () => {
    expect(normalizeToMonthly(1200, 'yearly')).toBe(100);
  });
});

describe('normalizeToWeekly', () => {
  it('returns amount unchanged for weekly frequency', () => {
    expect(normalizeToWeekly(100, 'weekly')).toBe(100);
  });

  it('divides fortnightly amount by 2', () => {
    expect(normalizeToWeekly(100, 'fortnightly')).toBe(50);
  });

  it('divides monthly amount by 4.33', () => {
    expect(normalizeToWeekly(433, 'monthly')).toBeCloseTo(100, 0);
  });

  it('divides yearly amount by 52', () => {
    expect(normalizeToWeekly(5200, 'yearly')).toBe(100);
  });
});

describe('generateBudget', () => {
  describe('with historical spending data', () => {
    it('allocates proportionally based on each category share of past spending', () => {
      const params: BudgetGenerationParams = {
        totalIncome: 5000,
        commitments: [{ amount: 1500, frequency: 'monthly' }],
        savingsContribution: 500,
        periodType: 'monthly',
        historicalSpending: [
          { category: 'Groceries', amount: 600 },
          { category: 'Transport', amount: 300 },
          { category: 'Entertainment', amount: 100 },
        ],
      };

      const result = generateBudget(params);
      expect(result.success).toBe(true);

      if (!result.success) return;

      // Available = 5000 - 1500 - 500 = 3000
      expect(result.availableIncome).toBe(3000);
      expect(result.totalCommitments).toBe(1500);
      expect(result.savingsContribution).toBe(500);

      // Total historical = 1000. Groceries = 60%, Transport = 30%, Entertainment = 10%
      const groceries = result.allocations.find((a) => a.category === 'Groceries');
      const transport = result.allocations.find((a) => a.category === 'Transport');
      const entertainment = result.allocations.find((a) => a.category === 'Entertainment');

      expect(groceries?.amount).toBeCloseTo(1800, 1); // 60% of 3000
      expect(transport?.amount).toBeCloseTo(900, 1);  // 30% of 3000
      expect(entertainment?.amount).toBeCloseTo(300, 1); // 10% of 3000
    });
  });

  describe('with 50/30/20 heuristic (no history)', () => {
    it('allocates 50% to needs, 30% to wants, 20% to savings (added to needs)', () => {
      const params: BudgetGenerationParams = {
        totalIncome: 4000,
        commitments: [],
        savingsContribution: 0,
        periodType: 'monthly',
      };

      const result = generateBudget(params);
      expect(result.success).toBe(true);

      if (!result.success) return;

      expect(result.availableIncome).toBe(4000);

      // 50% needs = 2000, split across 5 categories = 400 each
      // Plus 20% savings = 800, split among 5 needs = 160 each
      // So each needs category = 560
      const needsAllocations = result.allocations.filter((a) =>
        (NEEDS_CATEGORIES as readonly string[]).includes(a.category)
      );
      const wantsAllocations = result.allocations.filter((a) =>
        (WANTS_CATEGORIES as readonly string[]).includes(a.category)
      );

      const totalNeeds = needsAllocations.reduce((sum, a) => sum + a.amount, 0);
      const totalWants = wantsAllocations.reduce((sum, a) => sum + a.amount, 0);

      // Needs get 50% + 20% = 70% of available
      expect(totalNeeds).toBeCloseTo(4000 * 0.7, 1);
      // Wants get 30% of available
      expect(totalWants).toBeCloseTo(4000 * 0.3, 1);
    });

    it('creates allocations for all needs and wants categories', () => {
      const params: BudgetGenerationParams = {
        totalIncome: 2000,
        commitments: [],
        savingsContribution: 0,
        periodType: 'monthly',
      };

      const result = generateBudget(params);
      expect(result.success).toBe(true);
      if (!result.success) return;

      const categories = result.allocations.map((a) => a.category);
      for (const cat of NEEDS_CATEGORIES) {
        expect(categories).toContain(cat);
      }
      for (const cat of WANTS_CATEGORIES) {
        expect(categories).toContain(cat);
      }
    });
  });

  describe('shortfall case', () => {
    it('returns error when commitments exceed income', () => {
      const params: BudgetGenerationParams = {
        totalIncome: 1000,
        commitments: [{ amount: 800, frequency: 'monthly' }],
        savingsContribution: 400,
        periodType: 'monthly',
      };

      const result = generateBudget(params);
      expect(result.success).toBe(false);

      if (result.success) return;

      expect(result.error).toBeTruthy();
      expect(result.shortfall).toBe(200); // 1000 - 800 - 400 = -200
    });

    it('returns error when available income is exactly zero', () => {
      const params: BudgetGenerationParams = {
        totalIncome: 1000,
        commitments: [{ amount: 500, frequency: 'monthly' }],
        savingsContribution: 500,
        periodType: 'monthly',
      };

      const result = generateBudget(params);
      expect(result.success).toBe(false);

      if (result.success) return;
      expect(result.shortfall).toBe(0);
    });
  });

  describe('commitment normalization', () => {
    it('normalizes weekly commitments to monthly period', () => {
      const params: BudgetGenerationParams = {
        totalIncome: 5000,
        commitments: [{ amount: 100, frequency: 'weekly' }], // 100 * 4.33 = 433
        savingsContribution: 0,
        periodType: 'monthly',
      };

      const result = generateBudget(params);
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.totalCommitments).toBeCloseTo(433, 0);
      expect(result.availableIncome).toBeCloseTo(5000 - 433, 0);
    });

    it('normalizes monthly commitments to weekly period', () => {
      const params: BudgetGenerationParams = {
        totalIncome: 1000,
        commitments: [{ amount: 433, frequency: 'monthly' }], // 433 / 4.33 = ~100
        savingsContribution: 0,
        periodType: 'weekly',
      };

      const result = generateBudget(params);
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.totalCommitments).toBeCloseTo(100, 0);
    });
  });

  describe('total sums to available income', () => {
    it('allocations sum equals availableIncome within ±0.01 tolerance', () => {
      const params: BudgetGenerationParams = {
        totalIncome: 3333.33,
        commitments: [
          { amount: 100, frequency: 'weekly' },
          { amount: 200, frequency: 'fortnightly' },
        ],
        savingsContribution: 150.75,
        periodType: 'monthly',
        historicalSpending: [
          { category: 'Groceries', amount: 450 },
          { category: 'Transport', amount: 200 },
          { category: 'Entertainment', amount: 150 },
          { category: 'Dining', amount: 100 },
          { category: 'Shopping', amount: 75 },
        ],
      };

      const result = generateBudget(params);
      expect(result.success).toBe(true);
      if (!result.success) return;

      const total = result.allocations.reduce((sum, a) => sum + a.amount, 0);
      expect(Math.abs(total - result.availableIncome)).toBeLessThanOrEqual(0.01);
    });

    it('allocations sum equals availableIncome for 50/30/20 heuristic', () => {
      const params: BudgetGenerationParams = {
        totalIncome: 7777.77,
        commitments: [{ amount: 2000, frequency: 'monthly' }],
        savingsContribution: 777.77,
        periodType: 'monthly',
      };

      const result = generateBudget(params);
      expect(result.success).toBe(true);
      if (!result.success) return;

      const total = result.allocations.reduce((sum, a) => sum + a.amount, 0);
      expect(Math.abs(total - result.availableIncome)).toBeLessThanOrEqual(0.01);
    });
  });
});

describe('modifyAllocation', () => {
  it('redistributes difference proportionally across other non-fixed categories', () => {
    const allocations = [
      { category: 'Groceries' as Category, amount: 500, is_fixed: false },
      { category: 'Transport' as Category, amount: 300, is_fixed: false },
      { category: 'Entertainment' as Category, amount: 200, is_fixed: false },
    ];
    const availableIncome = 1000;

    // Reduce Groceries from 500 to 400 (frees up 100)
    const result = modifyAllocation(allocations, 'Groceries', 400, availableIncome);

    const groceries = result.find((a) => a.category === 'Groceries');
    expect(groceries?.amount).toBe(400);

    // Transport had 300/500 of remaining = 60%, so gets 60 more = 360
    const transport = result.find((a) => a.category === 'Transport');
    expect(transport?.amount).toBeCloseTo(360, 1);

    // Entertainment had 200/500 of remaining = 40%, so gets 40 more = 240
    const entertainment = result.find((a) => a.category === 'Entertainment');
    expect(entertainment?.amount).toBeCloseTo(240, 1);
  });

  it('maintains total equals available income after modification', () => {
    const allocations = [
      { category: 'Groceries' as Category, amount: 400, is_fixed: false },
      { category: 'Transport' as Category, amount: 300, is_fixed: false },
      { category: 'Entertainment' as Category, amount: 200, is_fixed: false },
      { category: 'Dining' as Category, amount: 100, is_fixed: false },
    ];
    const availableIncome = 1000;

    const result = modifyAllocation(allocations, 'Transport', 500, availableIncome);

    const total = result.reduce((sum, a) => sum + a.amount, 0);
    expect(Math.abs(total - availableIncome)).toBeLessThanOrEqual(0.01);
  });

  it('clamps newAmount to availableIncome', () => {
    const allocations = [
      { category: 'Groceries' as Category, amount: 500, is_fixed: false },
      { category: 'Transport' as Category, amount: 500, is_fixed: false },
    ];
    const availableIncome = 1000;

    const result = modifyAllocation(allocations, 'Groceries', 1500, availableIncome);

    const groceries = result.find((a) => a.category === 'Groceries');
    expect(groceries?.amount).toBeLessThanOrEqual(availableIncome);
  });

  it('does not modify fixed categories during redistribution', () => {
    const allocations = [
      { category: 'Housing' as Category, amount: 500, is_fixed: true },
      { category: 'Groceries' as Category, amount: 300, is_fixed: false },
      { category: 'Transport' as Category, amount: 200, is_fixed: false },
    ];
    const availableIncome = 1000;

    // Reduce Groceries by 100 → only Transport should absorb it
    const result = modifyAllocation(allocations, 'Groceries', 200, availableIncome);

    const housing = result.find((a) => a.category === 'Housing');
    expect(housing?.amount).toBe(500); // Fixed, unchanged

    const transport = result.find((a) => a.category === 'Transport');
    expect(transport?.amount).toBeCloseTo(300, 1); // Absorbed the 100
  });
});

describe('generateBudget with nothing recorded yet', () => {
  // A brand-new user clicking "Generate budget" was told their commitments
  // exceeded their income, with a shortfall of ₦0.00. They had neither.
  it('reports no income rather than a phantom shortfall', () => {
    const result = generateBudget({
      totalIncome: 0,
      commitments: [],
      savingsContribution: 0,
      periodType: 'monthly',
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.reason).toBe('no-income');
    expect(result.shortfall).toBe(0);
    expect(result.error).toMatch(/add your income/i);
    expect(result.error).not.toMatch(/exceed/i);
  });

  it('still reports a real shortfall when income exists but is fully committed', () => {
    const result = generateBudget({
      totalIncome: 100000,
      commitments: [
        { amount: 150000, frequency: 'monthly' },
      ],
      savingsContribution: 0,
      periodType: 'monthly',
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.reason).toBe('shortfall');
    expect(result.shortfall).toBe(50000);
  });

  it('treats income entirely consumed by commitments as a shortfall, not no-income', () => {
    const result = generateBudget({
      totalIncome: 100000,
      commitments: [
        { amount: 100000, frequency: 'monthly' },
      ],
      savingsContribution: 0,
      periodType: 'monthly',
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.reason).toBe('shortfall');
    expect(result.shortfall).toBe(0);
  });
});
