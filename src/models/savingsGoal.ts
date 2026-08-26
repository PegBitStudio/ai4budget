import { z } from 'zod';

export interface SavingsGoal {
  id: string;
  user_id: string;
  target_amount: number;
  deadline?: string;
  current_amount: number;
  monthly_contribution: number;
  created_at: string;
}

export const CreateSavingsGoalSchema = z.object({
  target_amount: z
    .number()
    .min(0.01, 'Target amount must be at least 0.01')
    .max(999999999.99, 'Target amount must not exceed 999,999,999.99'),
  deadline: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      'Deadline must be in ISO 8601 format (YYYY-MM-DD)'
    )
    .refine(
      (dateStr) => {
        const date = new Date(dateStr);
        return !isNaN(date.getTime());
      },
      { message: 'Deadline must be a valid calendar date' }
    )
    .refine(
      (dateStr) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const date = new Date(dateStr + 'T00:00:00');
        return date > today;
      },
      { message: 'Deadline must be in the future' }
    )
    .optional(),
});

export type CreateSavingsGoalInput = z.infer<typeof CreateSavingsGoalSchema>;

/** Recording money actually set aside toward a goal — not editing the goal. */
export const ContributeToSavingsGoalSchema = z.object({
  amount: z
    .number()
    .min(0.01, 'Amount must be at least 0.01')
    .max(999999999.99, 'Amount must not exceed 999,999,999.99'),
});

export type ContributeToSavingsGoalInput = z.infer<
  typeof ContributeToSavingsGoalSchema
>;
