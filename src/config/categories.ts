/**
 * Category configuration and rules for the 50/30/20 budgeting heuristic.
 */

import { CATEGORIES, Category } from '@/models/category';

/**
 * Categories considered "needs" for the 50/30/20 heuristic (50% allocation).
 */
export const NEEDS_CATEGORIES: readonly Category[] = [
  'Housing',
  'Transport',
  'Groceries',
  'Utilities',
  'Health',
] as const;

/**
 * Categories considered "wants" for the 50/30/20 heuristic (30% allocation).
 */
export const WANTS_CATEGORIES: readonly Category[] = [
  'Entertainment',
  'Dining',
  'Shopping',
  'Subscriptions',
] as const;

/**
 * Returns the type classification for a category under the 50/30/20 heuristic.
 */
export function getCategoryType(category: Category): 'needs' | 'wants' | 'other' {
  if ((NEEDS_CATEGORIES as readonly string[]).includes(category)) {
    return 'needs';
  }
  if ((WANTS_CATEGORIES as readonly string[]).includes(category)) {
    return 'wants';
  }
  return 'other';
}

/**
 * Hex color mapping for each category, used in charts and visualisations.
 */
export const CATEGORY_COLORS: Record<Category, string> = {
  Housing: '#3B82F6',       // blue-500
  Transport: '#8B5CF6',     // violet-500
  Groceries: '#10B981',     // emerald-500
  Utilities: '#F59E0B',     // amber-500
  Entertainment: '#EC4899', // pink-500
  Dining: '#F97316',        // orange-500
  Health: '#06B6D4',        // cyan-500
  Shopping: '#EF4444',      // red-500
  Subscriptions: '#6366F1', // indigo-500
  Other: '#6B7280',         // gray-500
};

// Re-export CATEGORIES for convenience
export { CATEGORIES };
