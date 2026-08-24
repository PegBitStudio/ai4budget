import { describe, it, expect } from 'vitest';
import {
  NEEDS_CATEGORIES,
  WANTS_CATEGORIES,
  getCategoryType,
  CATEGORY_COLORS,
  CATEGORIES,
} from './categories';
import { Category } from '@/models/category';

describe('categories config', () => {
  describe('NEEDS_CATEGORIES', () => {
    it('should contain exactly the expected needs categories', () => {
      expect(NEEDS_CATEGORIES).toEqual([
        'Housing',
        'Transport',
        'Groceries',
        'Utilities',
        'Health',
      ]);
    });
  });

  describe('WANTS_CATEGORIES', () => {
    it('should contain exactly the expected wants categories', () => {
      expect(WANTS_CATEGORIES).toEqual([
        'Entertainment',
        'Dining',
        'Shopping',
        'Subscriptions',
      ]);
    });
  });

  describe('getCategoryType', () => {
    it('should return "needs" for needs categories', () => {
      expect(getCategoryType('Housing')).toBe('needs');
      expect(getCategoryType('Transport')).toBe('needs');
      expect(getCategoryType('Groceries')).toBe('needs');
      expect(getCategoryType('Utilities')).toBe('needs');
      expect(getCategoryType('Health')).toBe('needs');
    });

    it('should return "wants" for wants categories', () => {
      expect(getCategoryType('Entertainment')).toBe('wants');
      expect(getCategoryType('Dining')).toBe('wants');
      expect(getCategoryType('Shopping')).toBe('wants');
      expect(getCategoryType('Subscriptions')).toBe('wants');
    });

    it('should return "other" for Other category', () => {
      expect(getCategoryType('Other')).toBe('other');
    });
  });

  describe('CATEGORY_COLORS', () => {
    it('should have a color for every category', () => {
      for (const category of CATEGORIES) {
        expect(CATEGORY_COLORS[category as Category]).toBeDefined();
        expect(CATEGORY_COLORS[category as Category]).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });

    it('should have 10 entries', () => {
      expect(Object.keys(CATEGORY_COLORS)).toHaveLength(10);
    });
  });

  describe('CATEGORIES re-export', () => {
    it('should re-export CATEGORIES array', () => {
      expect(CATEGORIES).toHaveLength(10);
      expect(CATEGORIES).toContain('Housing');
      expect(CATEGORIES).toContain('Other');
    });
  });
});
