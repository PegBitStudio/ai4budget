import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { CategorySchema } from '@/models/category';

export const dynamic = 'force-dynamic';

/**
 * Schema for PATCH request body. Every field is optional so a caller can send
 * just the category, or a full edit, but at least one must be present.
 */
const UpdateTransactionSchema = z
  .object({
    category: CategorySchema.optional(),
    amount: z
      .number()
      .min(0.01, 'Amount must be at least 0.01')
      .max(999999999.99, 'Amount must not exceed 999,999,999.99')
      .optional(),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in ISO 8601 format (YYYY-MM-DD)')
      .refine((value) => !isNaN(new Date(value).getTime()), {
        message: 'Date must be a valid calendar date',
      })
      .refine(
        (value) => {
          const today = new Date();
          today.setHours(23, 59, 59, 999);
          return new Date(`${value}T00:00:00`) <= today;
        },
        { message: 'Date must not be in the future' }
      )
      .optional(),
    description: z.string().min(1).max(255).optional(),
    type: z.enum(['income', 'expense']).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Nothing to update',
  });

/**
 * PATCH /api/transactions/[id]
 *
 * Updates a transaction. When the category changes, the new one is also stored
 * as a classification rule so future transactions with the same description
 * are filed the same way without asking again.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate body
    const body = await request.json();
    const validation = UpdateTransactionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { category, amount, date, description, type } = validation.data;

    // Only send the fields the caller actually supplied.
    const patch: {
      amount?: number;
      date?: string;
      description?: string;
      type?: 'income' | 'expense';
      category?: string;
      is_manual_category?: boolean;
    } = {};
    if (amount !== undefined) patch.amount = amount;
    if (date !== undefined) patch.date = date;
    if (description !== undefined) patch.description = description;
    if (type !== undefined) patch.type = type;
    if (category !== undefined) {
      patch.category = category;
      // The user picked this category, so stop the classifier overriding it.
      patch.is_manual_category = true;
    }

    // RLS ensures the user can only update their own transactions
    const { data: transaction, error: updateError } = await supabase
      .from('transactions')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      // Supabase returns PGRST116 when no rows match (RLS or wrong id)
      if (updateError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Transaction not found' },
          { status: 404 }
        );
      }
      console.error('[PATCH /api/transactions/[id]] Failed to update transaction:', updateError.message);
      return NextResponse.json(
        { error: 'Failed to update transaction' },
        { status: 500 }
      );
    }

    // Teach the classifier: the next transaction with this description gets
    // filed the same way without asking. This is the loop that makes the
    // assistant improve with use, so only a real category change writes to it.
    if (category !== undefined) {
      await supabase.from('classification_rules').upsert(
        {
          user_id: user.id,
          description: transaction.description,
          category,
        },
        { onConflict: 'user_id,description' }
      );
    }

    return NextResponse.json({ transaction }, { status: 200 });
  } catch (error) {
    console.error('[PATCH /api/transactions/[id]] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/transactions/[id]
 * Delete a transaction by id. RLS ensures user can only delete their own.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Delete the transaction — RLS ensures user can only delete their own
    const { error: deleteError, count } = await supabase
      .from('transactions')
      .delete({ count: 'exact' })
      .eq('id', id);

    if (deleteError) {
      console.error('[DELETE /api/transactions/[id]] Failed to delete transaction:', deleteError.message);
      return NextResponse.json(
        { error: 'Failed to delete transaction' },
        { status: 500 }
      );
    }

    // If no rows were deleted, the transaction doesn't exist (or isn't the user's)
    if (count === 0) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('[DELETE /api/transactions/[id]] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
