import { describe, it, expect } from 'vitest';
import { classify, DEFAULT_RULES, ClassificationResult } from './classifier';
import { Category } from '@/models/category';

describe('classifier', () => {
  describe('rule-based classification', () => {
    it('classifies housing-related descriptions', async () => {
      const result = await classify('Monthly rent payment');
      expect(result).toEqual({ category: 'Housing', source: 'rule' });
    });

    it('classifies transport-related descriptions', async () => {
      const result = await classify('Uber ride to airport');
      expect(result).toEqual({ category: 'Transport', source: 'rule' });
    });

    it('classifies grocery-related descriptions', async () => {
      const result = await classify('Woolworths groceries');
      expect(result).toEqual({ category: 'Groceries', source: 'rule' });
    });

    it('classifies utilities-related descriptions', async () => {
      const result = await classify('Internet bill January');
      expect(result).toEqual({ category: 'Utilities', source: 'rule' });
    });

    it('classifies subscription-related descriptions', async () => {
      const result = await classify('Netflix monthly subscription');
      expect(result).toEqual({ category: 'Subscriptions', source: 'rule' });
    });

    it('classifies dining-related descriptions', async () => {
      const result = await classify('Starbucks coffee');
      expect(result).toEqual({ category: 'Dining', source: 'rule' });
    });

    it('classifies entertainment-related descriptions', async () => {
      const result = await classify('Cinema tickets');
      expect(result).toEqual({ category: 'Entertainment', source: 'rule' });
    });

    it('classifies health-related descriptions', async () => {
      const result = await classify('Pharmacy prescription');
      expect(result).toEqual({ category: 'Health', source: 'rule' });
    });

    it('classifies shopping-related descriptions', async () => {
      const result = await classify('Amazon purchase - headphones');
      expect(result).toEqual({ category: 'Shopping', source: 'rule' });
    });

    it('is case-insensitive', async () => {
      const result = await classify('UBER RIDE');
      expect(result).toEqual({ category: 'Transport', source: 'rule' });
    });
  });

  describe('user corrections (highest priority)', () => {
    it('returns user correction when description matches exactly', async () => {
      const corrections = new Map<string, Category>([
        ['Starbucks coffee', 'Entertainment'],
      ]);
      const result = await classify('Starbucks coffee', corrections);
      expect(result).toEqual({ category: 'Entertainment', source: 'user-correction' });
    });

    it('user correction takes priority over rule-based match', async () => {
      const corrections = new Map<string, Category>([
        ['Netflix monthly subscription', 'Entertainment'],
      ]);
      const result = await classify('Netflix monthly subscription', corrections);
      expect(result).toEqual({ category: 'Entertainment', source: 'user-correction' });
    });

    it('user correction matching is case-insensitive', async () => {
      const corrections = new Map<string, Category>([
        ['uber ride', 'Dining'],
      ]);
      const result = await classify('Uber Ride', corrections);
      expect(result).toEqual({ category: 'Dining', source: 'user-correction' });
    });

    it('falls through to rules when no user correction matches', async () => {
      const corrections = new Map<string, Category>([
        ['some other thing', 'Health'],
      ]);
      const result = await classify('Uber ride', corrections);
      expect(result).toEqual({ category: 'Transport', source: 'rule' });
    });
  });

  describe('LLM fallback', () => {
    it('uses LLM when no rule matches', async () => {
      const llmClassify = async (_desc: string): Promise<Category | null> => 'Shopping';
      const result = await classify('random unknown purchase xyz', undefined, llmClassify);
      expect(result).toEqual({ category: 'Shopping', source: 'llm' });
    });

    it('falls back to "Other" when LLM returns null', async () => {
      const llmClassify = async (_desc: string): Promise<Category | null> => null;
      const result = await classify('random unknown purchase xyz', undefined, llmClassify);
      expect(result).toEqual({ category: 'Other', source: 'fallback' });
    });

    it('falls back to "Other" when LLM throws an error', async () => {
      const llmClassify = async (_desc: string): Promise<Category | null> => {
        throw new Error('LLM unavailable');
      };
      const result = await classify('random unknown purchase xyz', undefined, llmClassify);
      expect(result).toEqual({ category: 'Other', source: 'fallback' });
    });

    it('falls back to "Other" when LLM is not provided', async () => {
      const result = await classify('random unknown purchase xyz');
      expect(result).toEqual({ category: 'Other', source: 'fallback' });
    });
  });

  describe('DEFAULT_RULES', () => {
    it('covers all categories except Other', () => {
      const coveredCategories = new Set(DEFAULT_RULES.map((r) => r.category));
      expect(coveredCategories).toContain('Housing');
      expect(coveredCategories).toContain('Transport');
      expect(coveredCategories).toContain('Groceries');
      expect(coveredCategories).toContain('Utilities');
      expect(coveredCategories).toContain('Subscriptions');
      expect(coveredCategories).toContain('Dining');
      expect(coveredCategories).toContain('Entertainment');
      expect(coveredCategories).toContain('Health');
      expect(coveredCategories).toContain('Shopping');
      expect(coveredCategories.size).toBe(9); // All except "Other"
    });

    it('all rules have valid regex patterns', () => {
      for (const rule of DEFAULT_RULES) {
        expect(rule.pattern).toBeInstanceOf(RegExp);
        expect(rule.pattern.flags).toContain('i');
      }
    });
  });
});
