import { z } from 'zod';
import { CreateTransactionSchema, CreateTransactionInput } from '@/models/transaction';
import { CreateSavingsGoalSchema, CreateSavingsGoalInput } from '@/models/savingsGoal';
import { CreateCommitmentSchema, CreateCommitmentInput } from '@/models/commitment';

/**
 * Common amount validator: positive number between 0.01 and 999,999,999.99
 */
export const amountSchema = z
  .number()
  .min(0.01, 'Amount must be at least 0.01')
  .max(999999999.99, 'Amount must not exceed 999,999,999.99');

/**
 * Common date validator: ISO 8601 YYYY-MM-DD format, valid calendar date, not in the future
 */
export const dateSchema = z
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
  );

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: z.ZodIssue[] };

/**
 * Validates transaction input data against the CreateTransactionSchema.
 * Returns a discriminated union with either validated data or validation errors.
 */
export function validateTransaction(
  data: unknown
): ValidationResult<CreateTransactionInput> {
  const result = CreateTransactionSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.issues };
}

/**
 * Validates savings goal input data against the CreateSavingsGoalSchema.
 * Returns a discriminated union with either validated data or validation errors.
 */
export function validateSavingsGoal(
  data: unknown
): ValidationResult<CreateSavingsGoalInput> {
  const result = CreateSavingsGoalSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.issues };
}

/**
 * Validates financial commitment input data against the CreateCommitmentSchema.
 * Returns a discriminated union with either validated data or validation errors.
 */
export function validateCommitment(
  data: unknown
): ValidationResult<CreateCommitmentInput> {
  const result = CreateCommitmentSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.issues };
}
