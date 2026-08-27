import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { CreateTransactionSchema } from '@/models/transaction';
import { CategorySchema } from '@/models/category';

export const dynamic = 'force-dynamic';

/** Matches the per-paste cap in alertParser so the two limits agree. */
const MAX_ROWS = 200;

const BulkRowSchema = CreateTransactionSchema.extend({
  category: CategorySchema,
});

const BulkBodySchema = z.object({
  transactions: z.array(BulkRowSchema).min(1).max(MAX_ROWS),
  source: z.string().max(255).optional(),
});

/**
 * POST /api/transactions/bulk
 *
 * Stores a batch of transactions the user has already reviewed — the confirm
 * step for alert and CSV imports. Categories arrive from the review table, so
 * they are taken as given rather than re-classified.
 *
 * Body: { transactions: [...], source?: string }
 * Returns: { imported: number }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Expected a JSON body.' },
        { status: 400 }
      );
    }

    const parsed = BulkBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Some transactions could not be saved.',
          issues: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const { transactions, source } = parsed.data;

    const rows = transactions.map((t) => ({
      user_id: userId,
      amount: t.amount,
      date: t.date,
      description: t.description,
      category: t.category,
      type: t.type,
      source: source ?? t.source ?? null,
      // The user saw and accepted each category in the review table.
      is_manual_category: true,
    }));

    const { data, error } = await supabase
      .from('transactions')
      .insert(rows)
      .select('id');

    if (error) {
      console.error('[POST /api/transactions/bulk] Insert failed:', error);
      return NextResponse.json(
        { error: 'Could not save those transactions. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { imported: data?.length ?? rows.length },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/transactions/bulk] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
