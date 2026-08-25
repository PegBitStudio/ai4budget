import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getLLMClient } from '@/lib/llmClient';
import { classify } from '@/lib/classifier';
import { parseCSV } from '@/lib/csvService';
import { isDuplicate, ParsedAlert } from '@/lib/alertParser';
import { CATEGORIES, Category } from '@/models/category';

export const dynamic = 'force-dynamic';

/** Matches the alert importer, so both review tables behave the same. */
const MAX_PREVIEW_ROWS = 200;
const DUPLICATE_WINDOW_DAYS = 120;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

/**
 * POST /api/import/csv
 *
 * Reads a CSV file and returns its rows for review, classifying any that
 * arrive without a category. Nothing is written here — the user confirms via
 * POST /api/transactions/bulk, the same as the alert importer.
 *
 * Accepts multipart/form-data with a "file" field, or a raw text body.
 * Returns: { transactions: ParsedAlert[], issues: ParseIssue[] }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Read the file from either a form upload or a raw body.
    let csvContent: string;
    const contentType = request.headers.get('content-type') ?? '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');

      if (!file || !(file instanceof File)) {
        return NextResponse.json(
          { error: 'No file received. Choose a CSV file and try again.' },
          { status: 400 }
        );
      }

      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json(
          { error: 'That file is larger than 2 MB. Split it and import in parts.' },
          { status: 413 }
        );
      }

      csvContent = await file.text();
    } else {
      csvContent = await request.text();
    }

    if (!csvContent.trim()) {
      return NextResponse.json(
        { error: 'That file is empty.' },
        { status: 400 }
      );
    }

    const { transactions: parsed, errors } = parseCSV(csvContent);

    const issues = errors.map((e) => ({
      index: e.row,
      reason: `Row ${e.row}: ${e.message}`,
      raw: '',
    }));

    if (parsed.length === 0) {
      return NextResponse.json({ transactions: [], issues }, { status: 200 });
    }

    const rows = parsed.slice(0, MAX_PREVIEW_ROWS);
    if (parsed.length > MAX_PREVIEW_ROWS) {
      issues.push({
        index: MAX_PREVIEW_ROWS,
        reason: `Only the first ${MAX_PREVIEW_ROWS} rows are shown. Import the rest in a second file.`,
        raw: '',
      });
    }

    // Existing transactions across the range, to flag rows already imported.
    const earliest = rows.reduce(
      (min, r) => (r.date < min ? r.date : min),
      rows[0].date
    );
    const windowStart = new Date(earliest);
    windowStart.setDate(windowStart.getDate() - DUPLICATE_WINDOW_DAYS);

    const { data: existing } = await supabase
      .from('transactions')
      .select('date, amount, description')
      .gte('date', windowStart.toISOString().slice(0, 10));

    const existingRows = (existing ?? []).map((row) => ({
      date: row.date,
      amount: Number(row.amount),
      description: row.description,
    }));

    const { data: corrections } = await supabase
      .from('classification_rules')
      .select('description, category')
      .eq('user_id', user.id);

    const userCorrections = new Map<string, Category>();
    for (const rule of corrections ?? []) {
      userCorrections.set(rule.description, rule.category as Category);
    }

    const llmClient = getLLMClient();
    const llmClassify = llmClient.isAvailable()
      ? (desc: string) => llmClient.classifyTransaction(desc)
      : undefined;

    const transactions: ParsedAlert[] = await Promise.all(
      rows.map(async (row) => {
        // A category already in the file is the user's own labelling — most
        // often a re-import of this app's own export. Keep it.
        const fromFile = CATEGORIES.find(
          (c) => c.toLowerCase() === row.category?.toLowerCase()
        );

        let category: Category;
        if (row.type === 'income') {
          category = 'Other';
        } else if (fromFile) {
          category = fromFile;
        } else {
          category = (
            await classify(row.description, userCorrections, llmClassify)
          ).category;
        }

        return {
          date: row.date,
          description: row.description,
          amount: row.amount,
          type: row.type,
          category,
          duplicate: isDuplicate(row, existingRows),
        };
      })
    );

    return NextResponse.json({ transactions, issues }, { status: 200 });
  } catch (error) {
    console.error('[POST /api/import/csv] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
