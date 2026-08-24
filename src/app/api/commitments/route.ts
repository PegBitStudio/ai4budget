import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CreateCommitmentSchema } from '@/models/commitment';
import { classify } from '@/lib/classifier';

export const dynamic = 'force-dynamic';
/**
 * GET /api/commitments
 * Returns the authenticated user's financial commitments.
 */
export async function GET() {
  try {
    const supabase = await createClient();

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

    // Fetch commitments (RLS ensures user isolation)
    const { data: commitments, error: queryError } = await supabase
      .from('commitments')
      .select('*')
      .order('created_at', { ascending: false });

    if (queryError) {
      return NextResponse.json(
        { error: 'Failed to fetch commitments', details: queryError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { commitments: commitments ?? [] },
      { status: 200 }
    );
  } catch (error) {
    console.error('[GET /api/commitments] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/commitments
 * Create a new financial commitment with auto-classification of the description.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

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
    const validation = CreateCommitmentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { description, amount, frequency, category } = validation.data;

    // Classify the description to determine category if not explicitly provided,
    // otherwise use the user-supplied category
    let finalCategory = category;
    if (!category) {
      const classification = await classify(description);
      finalCategory = classification.category;
    }

    // Insert commitment
    const { data: commitment, error: insertError } = await supabase
      .from('commitments')
      .insert({
        user_id: user.id,
        description,
        amount,
        frequency,
        category: finalCategory,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: 'Failed to create commitment', details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ commitment }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/commitments] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/commitments?id=UUID
 * Delete a financial commitment by ID.
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

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

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Missing required query parameter: id' },
        { status: 400 }
      );
    }

    // Delete the commitment (RLS ensures user can only delete their own)
    const { data, error: deleteError } = await supabase
      .from('commitments')
      .delete()
      .eq('id', id)
      .select()
      .single();

    if (deleteError || !data) {
      return NextResponse.json(
        { error: 'Commitment not found' },
        { status: 404 }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('[DELETE /api/commitments] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
