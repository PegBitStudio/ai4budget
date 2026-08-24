import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { CategorySchema } from '@/models/category';

/**
 * Schema for PATCH request body — update transaction category.
 */
const UpdateCategorySchema = z.object({
  category: CategorySchema,
});

/**
 * PATCH /api/transactions/[id]
 * Update a transaction's category and store the user correction.
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
    const validation = UpdateCategorySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { category } = validation.data;

    // Update the transaction's category and set is_manual_category = true
    // RLS ensures the user can only update their own transactions
    const { data: transaction, error: updateError } = await supabase
      .from('transactions')
      .update({
        category,
        is_manual_category: true,
      })
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
      return NextResponse.json(
        { error: 'Failed to update transaction', details: updateError.message },
        { status: 500 }
      );
    }

    // Upsert into classification_rules so future transactions with
    // the same description automatically get this category
    await supabase
      .from('classification_rules')
      .upsert(
        {
          user_id: user.id,
          description: transaction.description,
          category,
        },
        { onConflict: 'user_id,description' }
      );

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
      return NextResponse.json(
        { error: 'Failed to delete transaction', details: deleteError.message },
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
