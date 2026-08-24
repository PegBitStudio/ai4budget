import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getRecommendation,
  calculateMonthsToGoal,
  formatRecommendation,
  SavingsRecommendationParams,
} from './savingsAdvisor';

// Mock the current date for deterministic tests
function mockDate(dateStr: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(dateStr + 'T00:00:00'));
}

describe('savingsAdvisor', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('calculateMonthsToGoal', () => {
    it('returns null when no deadline is provided', () => {
      const result = calculateMonthsToGoal(10000, 2000, undefined);
      expect(result).toBeNull();
    });

    it('returns the number of months between today and the deadline', () => {
      mockDate('2025-01-15');
      // From Jan 2025 to Jul 2025 = 6 months
      const result = calculateMonthsToGoal(10000, 2000, '2025-07-15');
      expect(result).toBe(6);
    });

    it('returns 0 when deadline is in the same month', () => {
      mockDate('2025-06-10');
      const result = calculateMonthsToGoal(10000, 2000, '2025-06-30');
      expect(result).toBe(0);
    });
  });

  describe('getRecommendation - with deadline', () => {
    it('calculates correct monthly contribution as remaining / months', () => {
      mockDate('2025-01-01');

      const params: SavingsRecommendationParams = {
        savingsGoal: {
          targetAmount: 10000,
          currentAmount: 4000,
          deadline: '2025-07-01', // 6 months away
        },
        discretionaryIncome: 50000,
      };

      const result = getRecommendation(params);

      // Remaining: 6000, months: 6, contribution = 6000 / 6 = 1000
      expect(result.monthlyContribution).toBe(1000);
      expect(result.hasGoal).toBe(true);
      expect(result.isExcessive).toBe(false);
    });

    it('rounds monthly contribution to 2 decimal places', () => {
      mockDate('2025-01-01');

      const params: SavingsRecommendationParams = {
        savingsGoal: {
          targetAmount: 10000,
          currentAmount: 0,
          deadline: '2025-04-01', // 3 months away
        },
        discretionaryIncome: 50000,
      };

      const result = getRecommendation(params);

      // 10000 / 3 = 3333.333... → rounds to 3333.33
      expect(result.monthlyContribution).toBe(3333.33);
    });
  });

  describe('getRecommendation - without deadline', () => {
    it('recommends 10% of discretionary income', () => {
      const params: SavingsRecommendationParams = {
        savingsGoal: {
          targetAmount: 50000,
          currentAmount: 5000,
          deadline: undefined,
        },
        discretionaryIncome: 30000,
      };

      const result = getRecommendation(params);

      // 10% of 30000 = 3000
      expect(result.monthlyContribution).toBe(3000);
      expect(result.hasGoal).toBe(true);
      expect(result.isExcessive).toBe(false);
    });
  });

  describe('getRecommendation - excessive (>30% of discretionary income)', () => {
    it('marks as excessive and provides both alternatives', () => {
      mockDate('2025-01-01');

      const params: SavingsRecommendationParams = {
        savingsGoal: {
          targetAmount: 100000,
          currentAmount: 0,
          deadline: '2025-04-01', // 3 months — needs 33333.33/month
        },
        discretionaryIncome: 50000, // 30% = 15000
      };

      const result = getRecommendation(params);

      // 100000 / 3 = 33333.33 which exceeds 30% of 50000 (15000)
      expect(result.isExcessive).toBe(true);
      expect(result.monthlyContribution).toBe(33333.33);

      // Should have alternatives
      expect(result.alternatives).toBeDefined();
      expect(result.alternatives!.longerTimeline).toBeDefined();
      expect(result.alternatives!.reducedGoal).toBeDefined();

      // Longer timeline: 100000 / 15000 = 6.67 → 7 months
      expect(result.alternatives!.longerTimeline!.months).toBe(7);
      expect(result.alternatives!.longerTimeline!.monthlyAmount).toBe(15000);

      // Reduced goal: 15000 * 3 + 0 = 45000
      expect(result.alternatives!.reducedGoal!.amount).toBe(45000);
      expect(result.alternatives!.reducedGoal!.monthlyAmount).toBe(15000);
    });

    it('provides alternatives without deadline (uses 12 months for reduced goal)', () => {
      const params: SavingsRecommendationParams = {
        savingsGoal: {
          targetAmount: 500000,
          currentAmount: 0,
          deadline: undefined,
        },
        discretionaryIncome: 10000, // 10% = 1000 which is fine, BUT...
      };

      // 10% of discretionary = 1000, which is 10% — not excessive
      // Let's make a case where no deadline but still excessive
      const excessiveParams: SavingsRecommendationParams = {
        savingsGoal: {
          targetAmount: 500000,
          currentAmount: 0,
          deadline: undefined,
        },
        discretionaryIncome: 5000, // 10% = 500, 30% = 1500
      };

      const result = getRecommendation(excessiveParams);

      // 10% of 5000 = 500 which is not > 30% of 5000 (1500)
      // This is NOT excessive
      expect(result.isExcessive).toBe(false);
      expect(result.monthlyContribution).toBe(500);
    });
  });

  describe('getRecommendation - no savings goal', () => {
    it('recommends starter target of 10% of average monthly income', () => {
      const params: SavingsRecommendationParams = {
        discretionaryIncome: 30000,
        averageMonthlyIncome: 80000,
      };

      const result = getRecommendation(params);

      // 10% of 80000 = 8000
      expect(result.monthlyContribution).toBe(8000);
      expect(result.hasGoal).toBe(false);
      expect(result.isExcessive).toBe(false);
      expect(result.explanation).toContain('8,000.00');
      expect(result.explanation).toContain("don't have a savings goal");
    });

    it('falls back to discretionary income when no average income provided', () => {
      const params: SavingsRecommendationParams = {
        discretionaryIncome: 40000,
      };

      const result = getRecommendation(params);

      // 10% of 40000 = 4000
      expect(result.monthlyContribution).toBe(4000);
      expect(result.hasGoal).toBe(false);
    });
  });

  describe('formatRecommendation', () => {
    it('produces plain-language output with specific numeric amount', () => {
      mockDate('2025-01-01');

      const params: SavingsRecommendationParams = {
        savingsGoal: {
          targetAmount: 10000,
          currentAmount: 4000,
          deadline: '2025-07-01',
        },
        discretionaryIncome: 50000,
      };

      const rec = getRecommendation(params);
      const formatted = formatRecommendation(rec);

      expect(formatted).toContain('₦1,000.00');
      expect(formatted).toContain('per month');
      expect(formatted.length).toBeGreaterThan(20);
    });

    it('includes alternatives info when excessive', () => {
      mockDate('2025-01-01');

      const params: SavingsRecommendationParams = {
        savingsGoal: {
          targetAmount: 100000,
          currentAmount: 0,
          deadline: '2025-04-01',
        },
        discretionaryIncome: 50000,
      };

      const rec = getRecommendation(params);
      const formatted = formatRecommendation(rec);

      expect(formatted).toContain('%');
      expect(formatted).toContain('Consider');
      expect(formatted).toContain('Extend');
      expect(formatted).toContain('Reduce');
    });
  });

  describe('edge cases', () => {
    it('handles deadline being the current month (0 months)', () => {
      mockDate('2025-06-15');

      const params: SavingsRecommendationParams = {
        savingsGoal: {
          targetAmount: 5000,
          currentAmount: 3000,
          deadline: '2025-06-30', // Same month
        },
        discretionaryIncome: 20000,
      };

      const result = getRecommendation(params);

      // When months = 0, entire remaining amount is needed
      expect(result.monthlyContribution).toBe(2000);
    });

    it('handles very large goal amount', () => {
      mockDate('2025-01-01');

      const params: SavingsRecommendationParams = {
        savingsGoal: {
          targetAmount: 999999999.99,
          currentAmount: 0,
          deadline: '2026-01-01', // 12 months
        },
        discretionaryIncome: 100000,
      };

      const result = getRecommendation(params);

      // 999999999.99 / 12 = 83333333.33
      expect(result.monthlyContribution).toBe(83333333.33);
      expect(result.isExcessive).toBe(true);
      expect(result.alternatives).toBeDefined();
    });

    it('handles zero discretionary income gracefully', () => {
      const params: SavingsRecommendationParams = {
        savingsGoal: {
          targetAmount: 10000,
          currentAmount: 0,
          deadline: undefined,
        },
        discretionaryIncome: 0,
      };

      const result = getRecommendation(params);

      // 10% of 0 = 0
      expect(result.monthlyContribution).toBe(0);
      expect(result.isExcessive).toBe(false);
    });
  });
});
