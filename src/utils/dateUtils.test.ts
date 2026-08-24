import { describe, it, expect } from 'vitest';
import {
  getCurrentMonthPeriod,
  getCurrentWeekPeriod,
  getPeriodForDate,
  getPreviousPeriod,
  getMonthsBetween,
  isWithinPeriod,
  formatDateDisplay,
} from './dateUtils';

describe('dateUtils', () => {
  describe('getCurrentMonthPeriod', () => {
    it('should return start as first day of current month', () => {
      const { start } = getCurrentMonthPeriod();
      expect(start).toMatch(/^\d{4}-\d{2}-01$/);
    });

    it('should return end as last day of current month', () => {
      const { end } = getCurrentMonthPeriod();
      const now = new Date();
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      expect(end).toContain(String(lastDay));
    });
  });

  describe('getCurrentWeekPeriod', () => {
    it('should return a 7-day range', () => {
      const { start, end } = getCurrentWeekPeriod();
      const startDate = new Date(start + 'T00:00:00');
      const endDate = new Date(end + 'T00:00:00');
      const days = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      expect(days).toBe(6);
    });

    it('should start on a Monday', () => {
      const { start } = getCurrentWeekPeriod();
      const startDate = new Date(start + 'T00:00:00');
      expect(startDate.getDay()).toBe(1); // Monday
    });

    it('should end on a Sunday', () => {
      const { end } = getCurrentWeekPeriod();
      const endDate = new Date(end + 'T00:00:00');
      expect(endDate.getDay()).toBe(0); // Sunday
    });
  });

  describe('getPeriodForDate', () => {
    it('should return monthly period for a given date', () => {
      const result = getPeriodForDate('2025-03-15', 'monthly');
      expect(result.start).toBe('2025-03-01');
      expect(result.end).toBe('2025-03-31');
    });

    it('should handle February correctly', () => {
      const result = getPeriodForDate('2024-02-15', 'monthly');
      expect(result.start).toBe('2024-02-01');
      expect(result.end).toBe('2024-02-29'); // 2024 is a leap year
    });

    it('should handle February non-leap year', () => {
      const result = getPeriodForDate('2025-02-15', 'monthly');
      expect(result.start).toBe('2025-02-01');
      expect(result.end).toBe('2025-02-28');
    });

    it('should return weekly period starting Monday', () => {
      // 2025-06-11 is a Wednesday
      const result = getPeriodForDate('2025-06-11', 'weekly');
      expect(result.start).toBe('2025-06-09'); // Monday
      expect(result.end).toBe('2025-06-15');   // Sunday
    });

    it('should handle a Sunday correctly for weekly period', () => {
      // 2025-06-15 is a Sunday
      const result = getPeriodForDate('2025-06-15', 'weekly');
      expect(result.start).toBe('2025-06-09'); // Monday
      expect(result.end).toBe('2025-06-15');   // Sunday
    });

    it('should handle a Monday correctly for weekly period', () => {
      // 2025-06-09 is a Monday
      const result = getPeriodForDate('2025-06-09', 'weekly');
      expect(result.start).toBe('2025-06-09');
      expect(result.end).toBe('2025-06-15');
    });
  });

  describe('getPreviousPeriod', () => {
    it('should return previous month', () => {
      const result = getPreviousPeriod('2025-03-01', 'monthly');
      expect(result.start).toBe('2025-02-01');
      expect(result.end).toBe('2025-02-28');
    });

    it('should handle January to December transition', () => {
      const result = getPreviousPeriod('2025-01-01', 'monthly');
      expect(result.start).toBe('2024-12-01');
      expect(result.end).toBe('2024-12-31');
    });

    it('should return previous week', () => {
      const result = getPreviousPeriod('2025-06-09', 'weekly');
      expect(result.start).toBe('2025-06-02');
      expect(result.end).toBe('2025-06-08');
    });
  });

  describe('getMonthsBetween', () => {
    it('should return 0 for same month', () => {
      expect(getMonthsBetween('2025-06-01', '2025-06-30')).toBe(0);
    });

    it('should return 1 for consecutive months', () => {
      expect(getMonthsBetween('2025-06-01', '2025-07-01')).toBe(1);
    });

    it('should return 12 for one year', () => {
      expect(getMonthsBetween('2024-06-15', '2025-06-15')).toBe(12);
    });

    it('should return 0 when end is before start', () => {
      expect(getMonthsBetween('2025-06-01', '2025-03-01')).toBe(0);
    });
  });

  describe('isWithinPeriod', () => {
    it('should return true for date within period', () => {
      expect(isWithinPeriod('2025-06-15', '2025-06-01', '2025-06-30')).toBe(true);
    });

    it('should return true for date on period start', () => {
      expect(isWithinPeriod('2025-06-01', '2025-06-01', '2025-06-30')).toBe(true);
    });

    it('should return true for date on period end', () => {
      expect(isWithinPeriod('2025-06-30', '2025-06-01', '2025-06-30')).toBe(true);
    });

    it('should return false for date before period', () => {
      expect(isWithinPeriod('2025-05-31', '2025-06-01', '2025-06-30')).toBe(false);
    });

    it('should return false for date after period', () => {
      expect(isWithinPeriod('2025-07-01', '2025-06-01', '2025-06-30')).toBe(false);
    });
  });

  describe('formatDateDisplay', () => {
    it('should format date as "day Month year"', () => {
      expect(formatDateDisplay('2025-06-15')).toBe('15 Jun 2025');
    });

    it('should handle single-digit day', () => {
      expect(formatDateDisplay('2025-01-03')).toBe('3 Jan 2025');
    });

    it('should handle December', () => {
      expect(formatDateDisplay('2025-12-25')).toBe('25 Dec 2025');
    });
  });
});
