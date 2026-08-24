import { describe, it, expect } from 'vitest';
import { formatCurrency, formatPercentage, formatCompactNumber } from './formatters';

describe('formatters', () => {
  describe('formatCurrency', () => {
    it('should format with default Naira symbol', () => {
      expect(formatCurrency(1234.56)).toBe('₦1,234.56');
    });

    it('should format with custom symbol', () => {
      expect(formatCurrency(1234.56, '$')).toBe('$1,234.56');
    });

    it('should format zero', () => {
      expect(formatCurrency(0)).toBe('₦0.00');
    });

    it('should format small amounts', () => {
      expect(formatCurrency(0.5)).toBe('₦0.50');
    });

    it('should format large amounts with commas', () => {
      expect(formatCurrency(1000000)).toBe('₦1,000,000.00');
    });

    it('should handle negative amounts', () => {
      expect(formatCurrency(-250.75)).toBe('-₦250.75');
    });

    it('should round to two decimal places', () => {
      expect(formatCurrency(10.999)).toBe('₦11.00');
    });
  });

  describe('formatPercentage', () => {
    it('should format with default 1 decimal', () => {
      expect(formatPercentage(12.567)).toBe('12.6%');
    });

    it('should format with specified decimals', () => {
      expect(formatPercentage(12.567, 2)).toBe('12.57%');
    });

    it('should format whole numbers', () => {
      expect(formatPercentage(50, 0)).toBe('50%');
    });

    it('should format zero', () => {
      expect(formatPercentage(0)).toBe('0.0%');
    });

    it('should handle negative percentages', () => {
      expect(formatPercentage(-5.5)).toBe('-5.5%');
    });
  });

  describe('formatCompactNumber', () => {
    it('should format thousands as K', () => {
      expect(formatCompactNumber(1234)).toBe('1.2K');
    });

    it('should format millions as M', () => {
      expect(formatCompactNumber(3456789)).toBe('3.5M');
    });

    it('should format billions as B', () => {
      expect(formatCompactNumber(1500000000)).toBe('1.5B');
    });

    it('should not compact numbers below 1000', () => {
      expect(formatCompactNumber(500)).toBe('500');
    });

    it('should handle exactly 1000', () => {
      expect(formatCompactNumber(1000)).toBe('1.0K');
    });

    it('should handle negative numbers', () => {
      expect(formatCompactNumber(-2500)).toBe('-2.5K');
    });

    it('should handle zero', () => {
      expect(formatCompactNumber(0)).toBe('0');
    });
  });
});
