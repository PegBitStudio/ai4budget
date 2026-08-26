import { describe, it, expect } from 'vitest';
import { CATEGORIES, CategorySchema } from './category';
import { CreateTransactionSchema } from './transaction';
import { CreateBudgetSchema } from './budget';
import { CreateSavingsGoalSchema, ContributeToSavingsGoalSchema } from './savingsGoal';
import { CreateCommitmentSchema } from './commitment';
import {
  validateTransaction,
  validateSavingsGoal,
  validateCommitment,
  amountSchema,
  dateSchema,
} from '@/lib/validation';

describe('Category model', () => {
  it('should have 10 categories', () => {
    expect(CATEGORIES).toHaveLength(10);
  });

  it('should validate valid categories', () => {
    for (const cat of CATEGORIES) {
      expect(CategorySchema.safeParse(cat).success).toBe(true);
    }
  });

  it('should reject invalid categories', () => {
    expect(CategorySchema.safeParse('InvalidCategory').success).toBe(false);
    expect(CategorySchema.safeParse('').success).toBe(false);
  });
});

describe('CreateTransactionSchema', () => {
  const validTransaction = {
    amount: 50.0,
    date: '2024-01-15',
    description: 'Grocery shopping',
    type: 'expense' as const,
  };

  it('should accept a valid transaction', () => {
    const result = CreateTransactionSchema.safeParse(validTransaction);
    expect(result.success).toBe(true);
  });

  it('should accept a transaction with optional source', () => {
    const result = CreateTransactionSchema.safeParse({
      ...validTransaction,
      type: 'income',
      source: 'Salary',
    });
    expect(result.success).toBe(true);
  });

  it('should reject amount below 0.01', () => {
    const result = CreateTransactionSchema.safeParse({
      ...validTransaction,
      amount: 0,
    });
    expect(result.success).toBe(false);
  });

  it('should reject amount above 999999999.99', () => {
    const result = CreateTransactionSchema.safeParse({
      ...validTransaction,
      amount: 1000000000,
    });
    expect(result.success).toBe(false);
  });

  it('should reject an invalid date format', () => {
    const result = CreateTransactionSchema.safeParse({
      ...validTransaction,
      date: '15-01-2024',
    });
    expect(result.success).toBe(false);
  });

  it('should reject a future date', () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    const futureDateStr = futureDate.toISOString().split('T')[0];
    const result = CreateTransactionSchema.safeParse({
      ...validTransaction,
      date: futureDateStr,
    });
    expect(result.success).toBe(false);
  });

  it('should reject an empty description', () => {
    const result = CreateTransactionSchema.safeParse({
      ...validTransaction,
      description: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject a description longer than 255 characters', () => {
    const result = CreateTransactionSchema.safeParse({
      ...validTransaction,
      description: 'x'.repeat(256),
    });
    expect(result.success).toBe(false);
  });

  it('should reject an invalid type', () => {
    const result = CreateTransactionSchema.safeParse({
      ...validTransaction,
      type: 'transfer',
    });
    expect(result.success).toBe(false);
  });
});

describe('CreateBudgetSchema', () => {
  const validBudget = {
    period_type: 'monthly' as const,
    period_start: '2024-01-01',
    period_end: '2024-01-31',
    total_income: 5000.0,
  };

  it('should accept a valid budget', () => {
    const result = CreateBudgetSchema.safeParse(validBudget);
    expect(result.success).toBe(true);
  });

  it('should accept budget with allocations', () => {
    const result = CreateBudgetSchema.safeParse({
      ...validBudget,
      allocations: [
        { category: 'Housing', amount: 1500, is_fixed: true },
        { category: 'Groceries', amount: 600, is_fixed: false },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid period type', () => {
    const result = CreateBudgetSchema.safeParse({
      ...validBudget,
      period_type: 'daily',
    });
    expect(result.success).toBe(false);
  });

  it('should reject income below 0.01', () => {
    const result = CreateBudgetSchema.safeParse({
      ...validBudget,
      total_income: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe('CreateSavingsGoalSchema', () => {
  it('should accept a valid savings goal with no deadline', () => {
    const result = CreateSavingsGoalSchema.safeParse({
      target_amount: 10000,
    });
    expect(result.success).toBe(true);
  });

  it('should accept a valid savings goal with a future deadline', () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    const futureDateStr = futureDate.toISOString().split('T')[0];
    const result = CreateSavingsGoalSchema.safeParse({
      target_amount: 10000,
      deadline: futureDateStr,
    });
    expect(result.success).toBe(true);
  });

  it('should reject target_amount below 0.01', () => {
    const result = CreateSavingsGoalSchema.safeParse({
      target_amount: 0,
    });
    expect(result.success).toBe(false);
  });

  it('should reject target_amount above 999999999.99', () => {
    const result = CreateSavingsGoalSchema.safeParse({
      target_amount: 1000000000,
    });
    expect(result.success).toBe(false);
  });

  it('should reject a past deadline', () => {
    const result = CreateSavingsGoalSchema.safeParse({
      target_amount: 10000,
      deadline: '2020-01-01',
    });
    expect(result.success).toBe(false);
  });
});

describe('ContributeToSavingsGoalSchema', () => {
  it('accepts a positive amount', () => {
    const result = ContributeToSavingsGoalSchema.safeParse({ amount: 1000 });
    expect(result.success).toBe(true);
  });

  it('rejects zero — a contribution has to be worth recording', () => {
    const result = ContributeToSavingsGoalSchema.safeParse({ amount: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects a negative amount', () => {
    const result = ContributeToSavingsGoalSchema.safeParse({ amount: -50 });
    expect(result.success).toBe(false);
  });

  it('rejects an amount above the storage ceiling', () => {
    const result = ContributeToSavingsGoalSchema.safeParse({
      amount: 1_000_000_000,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a missing amount', () => {
    const result = ContributeToSavingsGoalSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects a non-numeric amount', () => {
    const result = ContributeToSavingsGoalSchema.safeParse({ amount: '1000' });
    expect(result.success).toBe(false);
  });
});

describe('CreateCommitmentSchema', () => {
  const validCommitment = {
    description: 'Monthly rent',
    amount: 1500,
    frequency: 'monthly' as const,
    category: 'Housing' as const,
  };

  it('should accept a valid commitment', () => {
    const result = CreateCommitmentSchema.safeParse(validCommitment);
    expect(result.success).toBe(true);
  });

  it('should accept all valid frequencies', () => {
    for (const freq of ['weekly', 'fortnightly', 'monthly', 'yearly']) {
      const result = CreateCommitmentSchema.safeParse({
        ...validCommitment,
        frequency: freq,
      });
      expect(result.success).toBe(true);
    }
  });

  it('should reject an invalid frequency', () => {
    const result = CreateCommitmentSchema.safeParse({
      ...validCommitment,
      frequency: 'daily',
    });
    expect(result.success).toBe(false);
  });

  it('should reject an empty description', () => {
    const result = CreateCommitmentSchema.safeParse({
      ...validCommitment,
      description: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject amount below 0.01', () => {
    const result = CreateCommitmentSchema.safeParse({
      ...validCommitment,
      amount: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe('Shared validation helpers', () => {
  describe('amountSchema', () => {
    it('should accept valid amounts', () => {
      expect(amountSchema.safeParse(0.01).success).toBe(true);
      expect(amountSchema.safeParse(100).success).toBe(true);
      expect(amountSchema.safeParse(999999999.99).success).toBe(true);
    });

    it('should reject out-of-range amounts', () => {
      expect(amountSchema.safeParse(0).success).toBe(false);
      expect(amountSchema.safeParse(-5).success).toBe(false);
      expect(amountSchema.safeParse(1000000000).success).toBe(false);
    });
  });

  describe('dateSchema', () => {
    it('should accept a valid past date', () => {
      expect(dateSchema.safeParse('2024-01-15').success).toBe(true);
    });

    it('should reject invalid format', () => {
      expect(dateSchema.safeParse('01-15-2024').success).toBe(false);
      expect(dateSchema.safeParse('2024/01/15').success).toBe(false);
    });

    it('should reject a future date', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const futureDateStr = futureDate.toISOString().split('T')[0];
      expect(dateSchema.safeParse(futureDateStr).success).toBe(false);
    });
  });

  describe('validateTransaction', () => {
    it('should return success with valid data', () => {
      const result = validateTransaction({
        amount: 25.5,
        date: '2024-06-01',
        description: 'Coffee',
        type: 'expense',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.amount).toBe(25.5);
      }
    });

    it('should return errors with invalid data', () => {
      const result = validateTransaction({
        amount: -1,
        date: 'invalid',
        description: '',
        type: 'unknown',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });
  });

  describe('validateSavingsGoal', () => {
    it('should return success with valid data', () => {
      const result = validateSavingsGoal({ target_amount: 5000 });
      expect(result.success).toBe(true);
    });

    it('should return errors with invalid data', () => {
      const result = validateSavingsGoal({ target_amount: -100 });
      expect(result.success).toBe(false);
    });
  });

  describe('validateCommitment', () => {
    it('should return success with valid data', () => {
      const result = validateCommitment({
        description: 'Internet',
        amount: 79.99,
        frequency: 'monthly',
        category: 'Utilities',
      });
      expect(result.success).toBe(true);
    });

    it('should return errors with invalid data', () => {
      const result = validateCommitment({
        description: '',
        amount: 0,
        frequency: 'invalid',
        category: 'Invalid',
      });
      expect(result.success).toBe(false);
    });
  });
});
