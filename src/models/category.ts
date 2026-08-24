import { z } from 'zod';

export const CATEGORIES = [
  'Housing',
  'Transport',
  'Groceries',
  'Utilities',
  'Entertainment',
  'Dining',
  'Health',
  'Shopping',
  'Subscriptions',
  'Other',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CategorySchema = z.enum(CATEGORIES);
