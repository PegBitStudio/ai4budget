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
 * A fixed colour per category, used for identity — the dot beside a
 * transaction, the marker on a budget row — never as a chart mark.
 *
 * That distinction is deliberate. On a ranked bar chart the bar length already
 * encodes magnitude, so painting each bar its own hue would spend the only free
 * channel restating it. In a list, colour does real work: it is how you pick
 * "Transport" out of forty rows without reading a word.
 *
 * These are a validated categorical set, bound to the category name and never
 * to its rank — a filter that changes which categories are on screen must not
 * repaint the survivors. On a white surface the set passes the lightness band,
 * the chroma floor, adjacent CVD separation (worst ΔE 9.1) and normal-vision
 * separation (worst ΔE 19.6). Three slots fall under 3:1 contrast, so a dot is
 * always rendered beside its written label — never colour alone.
 */
export const CATEGORY_COLORS: Record<Category, string> = {
  Housing: '#2a78d6',       // blue
  Transport: '#eb6834',     // orange
  Groceries: '#1baf7a',     // aqua
  Dining: '#eda100',        // yellow
  Shopping: '#e87ba4',      // magenta
  Subscriptions: '#4a3aa7', // violet
  Utilities: '#008300',     // green
  Health: '#e34948',        // red
  Entertainment: '#0e7c66', // the product accent
  Other: '#949c9e',         // neutral — deliberately not a hue
};

// Re-export CATEGORIES for convenience
export { CATEGORIES };

/**
 * The marker colour for a category. Always rendered beside the written label
 * — never as the only carrier of meaning.
 */
export function categoryColor(category: string): string {
  return CATEGORY_COLORS[category as Category] ?? CATEGORY_COLORS.Other;
}
