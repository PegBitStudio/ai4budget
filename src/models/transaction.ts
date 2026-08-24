import { z } from 'zod';
import { Category, CategorySchema } from './category';

export interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  date: string;
  description: string;
  category: Category;
  type: 'income' | 'expense';
  source?: string;
  is_manual_category: boolean;
  created_at: string;
}

export const TransactionTypeSchema = z.enum(['income', 'expense']);

export const CreateTransactionSchema = z.object({
  amount: z
    .number()
    .min(0.01, 'Amount must be at least 0.01')
    .max(999999999.99, 'Amount must not exceed 999,999,999.99'),
  date: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      'Date must be in ISO 8601 format (YYYY-MM-DD)'
    )
    .refine(
      (dateStr) => {
        const date = new Date(dateStr);
        return !isNaN(date.getTime());
      },
      { message: 'Date must be a valid calendar date' }
    )
    .refine(
      (dateStr) => {
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const date = new Date(dateStr + 'T00:00:00');
        return date <= today;
      },
      { message: 'Date must not be in the future' }
    ),
  description: z
    .string()
    .min(1, 'Description must be at least 1 character')
    .max(255, 'Description must not exceed 255 characters'),
  type: TransactionTypeSchema,
  source: z
    .string()
    .max(255, 'Source must not exceed 255 characters')
    .optional(),
});

export type CreateTransactionInput = z.infer<typeof CreateTransactionSchema>;
