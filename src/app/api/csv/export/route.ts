import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { exportCSV, generateExportFilename, ExportTransaction } from '@/lib/csvService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/csv/export
 *
 * Queries all user's transactions ordered by date ascending,
 * generates a CSV string, and returns it as a downloadable file.
 *
 * Returns:
 * - 200 with CSV file (Content-Type: text/csv, Content-Disposition: attachment)
 * - 401 if not authenticated
 * - 404 if no transactions exist
 * - 500 for unexpected errors
 */
export async function GET() {
  try {
    // Auth check
    const supabase = await createClient();
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

    // Query all user's transactions ordered by date ascending
    const { data: transactions, error: queryError } = await supabase
      .from('transactions')
      .select('date, description, amount, category, type')
      .eq('user_id', user.id)
      .order('date', { ascending: true });

    if (queryError) {
      return NextResponse.json(
        { error: 'Failed to fetch transactions.' },
        { status: 500 }
      );
    }

    // If no transactions exist, return 404
    if (!transactions || transactions.length === 0) {
      return NextResponse.json(
        { error: 'No transactions to export' },
        { status: 404 }
      );
    }

    // Map to ExportTransaction format
    const exportData: ExportTransaction[] = transactions.map((t) => ({
      date: t.date,
      description: t.description,
      amount: t.amount,
      category: t.category,
      type: t.type as 'income' | 'expense',
    }));

    // Generate CSV content
    const csvContent = exportCSV(exportData);

    // Generate filename
    const filename = generateExportFilename();

    // Return as downloadable CSV file
    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('[GET /api/csv/export] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
