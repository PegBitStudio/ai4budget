import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getLLMClient } from '@/lib/llmClient';
import { classify } from '@/lib/classifier';
import {
  validateParsedAlerts,
  isDuplicate,
  chunkAlertText,
  MAX_INPUT_CHARS,
  ParsedAlert,
} from '@/lib/alertParser';
import { Category } from '@/models/category';

export const dynamic = 'force-dynamic';

/** How far back to look when checking whether a parsed row already exists. */
const DUPLICATE_WINDOW_DAYS = 120;

/**
 * POST /api/import/alerts
 *
 * Reads transactions out of pasted bank alert text and returns them for the
 * user to review. Nothing is written to the database here — the user confirms
 * the rows first, via POST /api/transactions/bulk.
 *
 * Body: { text: string }
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

    let body: { text?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Expected a JSON body containing your alert text.' },
        { status: 400 }
      );
    }

    const text = typeof body.text === 'string' ? body.text.trim() : '';

    if (!text) {
      return NextResponse.json(
        { error: 'Paste some bank alerts first.' },
        { status: 400 }
      );
    }

    if (text.length > MAX_INPUT_CHARS) {
      return NextResponse.json(
        {
          error: `That is a lot of text — ${text.length.toLocaleString()} characters. Paste up to ${MAX_INPUT_CHARS.toLocaleString()} at a time.`,
        },
        { status: 413 }
      );
    }

    const llmClient = getLLMClient();

    if (!llmClient.isAvailable()) {
      return NextResponse.json(
        {
          error:
            'Reading alerts needs the AI assistant, which is not configured on this deployment.',
        },
        { status: 503 }
      );
    }

    // Read the paste in small batches: asked to extract from a dozen alerts at
    // once the model drops some, so each batch gets its own call.
    const batches = chunkAlertText(text);
    const results = await Promise.all(
      batches.map((batch) => llmClient.parseBankAlerts(batch))
    );

    // Every batch failing means the model is unreachable, not that the text was
    // unreadable — say so rather than claiming we found nothing.
    if (results.length > 0 && results.every((r) => r === null)) {
      return NextResponse.json(
        {
          error:
            'Could not read those alerts. Try pasting fewer at a time, or check the text came through intact.',
        },
        { status: 502 }
      );
    }

    const rawRows = results.flatMap((rows) => rows ?? []);
    const failedBatches = results.filter((r) => r === null).length;

    const { alerts, issues } = validateParsedAlerts(rawRows);

    if (failedBatches > 0) {
      issues.push({
        index: -1,
        reason: `${failedBatches} section${failedBatches === 1 ? '' : 's'} of your paste could not be read. Anything missing can be pasted again on its own.`,
        raw: '',
      });
    }

    if (alerts.length === 0) {
      return NextResponse.json({ transactions: [], issues }, { status: 200 });
    }

    // Existing transactions in the window the parsed rows fall into, so we can
    // warn about alerts that have already been imported.
    const earliest = alerts.reduce(
      (min, a) => (a.date < min ? a.date : min),
      alerts[0].date
    );
    const windowStart = new Date(earliest);
    windowStart.setDate(windowStart.getDate() - DUPLICATE_WINDOW_DAYS);
    const windowStartISO = windowStart.toISOString().slice(0, 10);

    const { data: existing } = await supabase
      .from('transactions')
      .select('date, amount, description')
      .gte('date', windowStartISO);

    const existingRows = (existing ?? []).map((row) => ({
      date: row.date,
      amount: Number(row.amount),
      description: row.description,
    }));

    // The user's own past corrections take priority over rules and the model.
    const { data: corrections } = await supabase
      .from('classification_rules')
      .select('description, category')
      .eq('user_id', user.id);

    const userCorrections = new Map<string, Category>();
    for (const rule of corrections ?? []) {
      userCorrections.set(rule.description, rule.category as Category);
    }

    const llmClassify = (desc: string) => llmClient.classifyTransaction(desc);

    // Classify in parallel — each miss on the rule table is a separate call.
    const transactions: ParsedAlert[] = await Promise.all(
      alerts.map(async (alert) => {
        const { category } = await classify(
          alert.description,
          userCorrections,
          // Income is never a spending category; don't spend a call on it.
          alert.type === 'income' ? undefined : llmClassify
        );

        return {
          ...alert,
          category: alert.type === 'income' ? ('Other' as Category) : category,
          duplicate: isDuplicate(alert, existingRows),
        };
      })
    );

    return NextResponse.json({ transactions, issues }, { status: 200 });
  } catch (error) {
    console.error('[POST /api/import/alerts] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
