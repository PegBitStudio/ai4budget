import { z } from 'zod';
import { Category, CategorySchema } from './category';

export interface FinancialCommitment {
  id: string;
  user_id: string;
  description: string;
  amount: number;
  frequency: 'weekly' | 'fortnightly' | 'monthly' | 'yearly';
  category: Category;
  created_at: string;
}

export const FrequencySchema = z.enum([
  'weekly',
  'fortnightly',
  'monthly',
  'yearly',
]);

export const CreateCommitmentSchema = z.object({
  description: z
    .string()
    .min(1, 'Description must be at least 1 character')
    .max(255, 'Description must not exceed 255 characters'),
  amount: z
    .number()
    .min(0.01, 'Amount must be at least 0.01')
    .max(999999999.99, 'Amount must not exceed 999,999,999.99'),
  frequency: FrequencySchema,
  category: CategorySchema,
});

export type CreateCommitmentInput = z.infer<typeof CreateCommitmentSchema>;
