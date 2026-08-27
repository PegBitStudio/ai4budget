import { z } from 'zod';
import { Category, CategorySchema } from './category';

export interface CategoryAllocation {
  category: Category;
  amount: number;
  is_fixed: boolean;
}

export interface Budget {
  id: string;
  user_id: string;
  period_type: 'weekly' | 'monthly';
  period_start: string;
  period_end: string;
  total_income: number;
  allocations: CategoryAllocation[];
  created_at: string;
}

export interface BudgetComparison {
  category: Category;
  budgeted: number;
  actual: number;
  variance: number;
  status: 'under' | 'on-track' | 'over';
}

export const PeriodTypeSchema = z.enum(['weekly', 'monthly']);

export const CategoryAllocationSchema = z.object({
  category: CategorySchema,
  amount: z
    .number()
    .min(0, 'Allocation amount must be non-negative'),
  is_fixed: z.boolean(),
});

export const CreateBudgetSchema = z.object({
  period_type: PeriodTypeSchema,
  period_start: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      'Period start must be in ISO 8601 format (YYYY-MM-DD)'
    )
    .refine(
      (dateStr) => {
        const date = new Date(dateStr);
        return !isNaN(date.getTime());
      },
      { message: 'Period start must be a valid calendar date' }
    ),
  period_end: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      'Period end must be in ISO 8601 format (YYYY-MM-DD)'
    )
    .refine(
      (dateStr) => {
        const date = new Date(dateStr);
        return !isNaN(date.getTime());
      },
      { message: 'Period end must be a valid calendar date' }
    ),
  total_income: z
    .number()
    .min(0.01, 'Total income must be at least 0.01')
    .max(999999999.99, 'Total income must not exceed 999,999,999.99'),
  allocations: z.array(CategoryAllocationSchema).optional(),
});

export type CreateBudgetInput = z.infer<typeof CreateBudgetSchema>;

/**
 * A budget built by hand — from a blank start, or from an uploaded template —
 * rather than derived from logged transactions. No income transaction is
 * required: `total_income` is optional here because a person planning ahead
 * may not have decided on one yet, and any category left out simply starts
 * at 0 rather than being rejected.
 */
export const CreateManualBudgetSchema = z.object({
  period_type: PeriodTypeSchema,
  total_income: z
    .number()
    .min(0, 'Total income must be non-negative')
    .max(999999999.99, 'Total income must not exceed 999,999,999.99')
    .optional(),
  allocations: z.array(
    z.object({
      category: CategorySchema,
      amount: z
        .number()
        .min(0, 'Allocation amount must be non-negative')
        .max(999999999.99, 'Allocation amount must not exceed 999,999,999.99'),
    })
  ),
});

export type CreateManualBudgetInput = z.infer<typeof CreateManualBudgetSchema>;
