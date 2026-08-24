import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseCSV, CSVError } from '@/lib/csvService';
import { classify } from '@/lib/classifier';
import { getLLMClient } from '@/lib/llmClient';
import { Category } from '@/models/category';

/**
 * POST /api/csv/import
 *
 * Accepts either:
 * - multipart/form-data with a "file" field containing a CSV file
 * - text body with raw CSV content (Content-Type: text/csv or text/plain)
 *
 * Parses the CSV, validates rows, classifies each valid transaction,
 * and inserts them into the transactions table.
 *
 * Returns: { imported: number, errors: CSVError[] }
 */
export async function POST(request: NextRequest) {
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

    // Extract CSV content from the request
    let csvContent: string;

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      // Handle file upload via multipart/form-data
      const formData = await request.formData();
      const file = formData.get('file');

      if (!file || !(file instanceof File)) {
        return NextResponse.json(
          { error: 'No file provided. Please upload a CSV file.' },
          { status: 400 }
        );
      }

      csvContent = await file.text();
    } else {
      // Handle raw text body (text/csv or text/plain)
      csvContent = await request.text();
    }

    if (!csvContent.trim()) {
      return NextResponse.json(
        { imported: 0, errors: [] },
        { status: 200 }
      );
    }

    // Parse and validate CSV
    const { transactions, errors } = parseCSV(csvContent);

    // If parsing produced a fatal error (e.g., too many rows) and no transactions, return early
    if (transactions.length === 0 && errors.length > 0) {
      return NextResponse.json({ imported: 0, errors }, { status: 200 });
    }

    // Load user corrections for classification
    const { data: corrections } = await supabase
      .from('classification_rules')
      .select('description, category')
      .eq('user_id', user.id);

    const userCorrections = new Map<string, Category>();
    if (corrections) {
      for (const rule of corrections) {
        userCorrections.set(rule.description, rule.category as Category);
      }
    }

    // Get LLM client for fallback classification
    const llmClient = getLLMClient();
    const llmClassify = llmClient.isAvailable()
      ? (desc: string) => llmClient.classifyTransaction(desc)
      : undefined;

    // Classify and insert each valid transaction
    let imported = 0;
    const insertErrors: CSVError[] = [...errors];

    for (let i = 0; i < transactions.length; i++) {
      const t = transactions[i];

      // Classify the transaction
      const classificationResult = await classify(
        t.description,
        userCorrections,
        llmClassify
      );

      // Insert into database
      const { error: insertError } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          amount: t.amount,
          date: t.date,
          description: t.description,
          category: classificationResult.category,
          type: 'expense',
          is_manual_category: false,
        });

      if (insertError) {
        insertErrors.push({
          row: i + 1,
          field: 'database',
          message: `Failed to insert transaction: ${insertError.message}`,
        });
      } else {
        imported++;
      }
    }

    return NextResponse.json(
      { imported, errors: insertErrors },
      { status: 200 }
    );
  } catch (error) {
    console.error('[POST /api/csv/import] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
