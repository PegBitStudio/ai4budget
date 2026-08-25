/**
 * Normalisation, validation and duplicate detection for transactions extracted
 * from pasted bank alerts.
 *
 * The language model does the reading — Nigerian bank alerts arrive in a dozen
 * different shapes and no regex survives contact with all of them. Everything
 * in this file is the safety net around that: it never trusts the model's
 * output, and nothing reaches the database until it has passed through here.
 *
 * Pure business logic — no database calls, no network.
 */

import { Category } from '@/models/category';

// --- Types ---

/** A transaction the model claims to have found in the pasted text. */
export interface RawParsedAlert {
  date?: unknown;
  description?: unknown;
  amount?: unknown;
  type?: unknown;
}

/** A transaction that survived validation and is safe to show the user. */
export interface ParsedAlert {
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: Category;
  /** True when an existing transaction looks like this same payment. */
  duplicate: boolean;
}

export interface ParseIssue {
  index: number;
  reason: string;
  raw: string;
}

// --- Constants ---

export const MAX_INPUT_CHARS = 20_000;
export const MAX_ALERTS_PER_PASTE = 200;

const MIN_AMOUNT = 0.01;
const MAX_AMOUNT = 999_999_999.99;
const MAX_DESCRIPTION_LENGTH = 255;

/** How far back a pasted alert may plausibly be dated. */
const MAX_AGE_YEARS = 5;
/** Small allowance for timezone skew between the user's phone and the server. */
const FUTURE_TOLERANCE_DAYS = 1;

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

// --- Chunking ---

/** Alert blocks per model call. Small batches keep extraction recall high. */
export const BLOCKS_PER_BATCH = 6;

/** Lines per block when the paste has no blank lines to split on. */
const LINES_PER_FALLBACK_BLOCK = 6;

/**
 * Splits a paste into batches small enough for the model to read exhaustively.
 *
 * Asked to extract from a dozen alerts at once, the model reliably drops a
 * few — it summarises rather than enumerates. Feeding it a handful at a time
 * fixes that, and the batches can run in parallel.
 *
 * Alerts are separated by blank lines in every format we have seen, so blocks
 * split there and multi-line alerts stay intact. A paste with no blank lines
 * falls back to fixed groups of lines.
 */
export function chunkAlertText(
  text: string,
  blocksPerBatch: number = BLOCKS_PER_BATCH
): string[] {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }

  let blocks = trimmed
    .split(/\n\s*\n+/)
    .map((block) => block.trim())
    .filter(Boolean);

  // No blank lines: treat each run of lines as a block instead.
  if (blocks.length === 1) {
    const lines = trimmed.split(/\n/).filter((line) => line.trim());
    if (lines.length > LINES_PER_FALLBACK_BLOCK) {
      blocks = [];
      for (let i = 0; i < lines.length; i += LINES_PER_FALLBACK_BLOCK) {
        blocks.push(lines.slice(i, i + LINES_PER_FALLBACK_BLOCK).join('\n'));
      }
    }
  }

  const batches: string[] = [];
  for (let i = 0; i < blocks.length; i += blocksPerBatch) {
    batches.push(blocks.slice(i, i + blocksPerBatch).join('\n\n'));
  }

  return batches;
}

// --- Amount ---

/**
 * Pulls a number out of the many ways an alert can write money:
 * "NGN5,000.00", "₦ 12,000", "3200.50", "NGN 1,500.00 DR".
 *
 * Returns null when there is no usable number.
 */
export function normaliseAmount(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.abs(value) : null;
  }
  if (typeof value !== 'string') {
    return null;
  }

  // Strip currency words/symbols and any trailing DR/CR marker.
  const cleaned = value
    .replace(/ngn|naira|₦/gi, '')
    .replace(/\b(dr|cr)\b/gi, '')
    .replace(/,/g, '')
    .trim();

  const match = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!match) {
    return null;
  }

  const amount = Math.abs(Number(match[0]));
  return Number.isFinite(amount) ? amount : null;
}

// --- Date ---

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function isRealCalendarDate(year: number, month: number, day: number): boolean {
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function expandYear(year: number): number {
  // "26" means 2026, not 26 AD.
  return year < 100 ? 2000 + year : year;
}

/**
 * Converts the date formats Nigerian bank alerts actually use into YYYY-MM-DD.
 *
 * Handles: 2026-08-12, 12-AUG-2026, 4 Aug 2026, Aug 4 2026, 05/08/2026.
 *
 * Numeric slash/dot dates are read as DAY first, which is the convention here.
 * An unambiguous value (13/08) confirms it; a genuinely ambiguous one (05/08)
 * is read as 5 August, not 8 May.
 */
export function normaliseDate(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const input = value.trim();
  if (!input) {
    return null;
  }

  // Already ISO, possibly with a time component.
  const iso = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const [, y, m, d] = iso;
    return isRealCalendarDate(+y, +m, +d) ? `${y}-${m}-${d}` : null;
  }

  // 12-AUG-2026 / 12 Aug 26 / 12.August.2026 / 4th August 2026
  const dayFirstName = input.match(
    /^(\d{1,2})(?:st|nd|rd|th)?[-\s./]+([A-Za-z]{3,9})[-\s./]+(\d{2,4})/i
  );
  if (dayFirstName) {
    const [, d, monthName, y] = dayFirstName;
    const month = MONTHS[monthName.slice(0, 4).toLowerCase()] ?? MONTHS[monthName.slice(0, 3).toLowerCase()];
    const year = expandYear(+y);
    if (month && isRealCalendarDate(year, month, +d)) {
      return `${year}-${pad(month)}-${pad(+d)}`;
    }
    return null;
  }

  // Aug 4, 2026 / August 4 2026
  const monthFirstName = input.match(
    /^([A-Za-z]{3,9})[-\s./]+(\d{1,2})(?:st|nd|rd|th)?,?[-\s./]+(\d{2,4})/
  );
  if (monthFirstName) {
    const [, monthName, d, y] = monthFirstName;
    const month = MONTHS[monthName.slice(0, 4).toLowerCase()] ?? MONTHS[monthName.slice(0, 3).toLowerCase()];
    const year = expandYear(+y);
    if (month && isRealCalendarDate(year, month, +d)) {
      return `${year}-${pad(month)}-${pad(+d)}`;
    }
    return null;
  }

  // 05/08/2026 — day first.
  const numeric = input.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/);
  if (numeric) {
    const [, first, second, y] = numeric;
    const year = expandYear(+y);
    let day = +first;
    let month = +second;

    // If the first part cannot be a day, the alert used month-first.
    if (day > 12 && month <= 12) {
      // Day-first confirmed; nothing to swap.
    } else if (month > 12 && day <= 12) {
      [day, month] = [month, day];
    }

    if (isRealCalendarDate(year, month, day)) {
      return `${year}-${pad(month)}-${pad(day)}`;
    }
    return null;
  }

  return null;
}

/**
 * Rejects dates that cannot plausibly belong to a bank alert someone just
 * pasted — far-future dates and anything older than a few years are almost
 * always a misread year rather than a real transaction.
 */
export function isPlausibleDate(date: string, today: Date = new Date()): boolean {
  const [y, m, d] = date.split('-').map(Number);
  const parsed = new Date(y, m - 1, d);

  const latest = new Date(today);
  latest.setDate(latest.getDate() + FUTURE_TOLERANCE_DAYS);

  const earliest = new Date(today);
  earliest.setFullYear(earliest.getFullYear() - MAX_AGE_YEARS);

  return parsed >= earliest && parsed <= latest;
}

// --- Description ---

export function normaliseDescription(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  // Collapse the whitespace and separator noise typical of alert narrations.
  const cleaned = value
    .replace(/\s+/g, ' ')
    .replace(/^[\s/|-]+|[\s/|-]+$/g, '')
    .trim();

  if (!cleaned) {
    return null;
  }

  return cleaned.slice(0, MAX_DESCRIPTION_LENGTH);
}

// --- Duplicate detection ---

/**
 * Reduces a description to a comparison key: lowercase, letters and digits
 * only. "POS/WEB PURCHASE/BOLT" and "Bolt purchase (POS web)" collapse close
 * enough to compare, without pulling in a fuzzy-matching dependency.
 */
function descriptionKey(description: string): string {
  return description.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Flags a parsed row as a duplicate when an existing transaction shares its
 * date and amount, and the descriptions overlap.
 *
 * Same-day same-amount is already a strong signal — people rarely spend the
 * identical amount twice in a day — so the description check is deliberately
 * loose: either key containing the other counts.
 */
export function isDuplicate(
  candidate: { date: string; amount: number; description: string },
  existing: { date: string; amount: number; description: string }[]
): boolean {
  const candidateKey = descriptionKey(candidate.description);

  return existing.some((row) => {
    if (row.date !== candidate.date) return false;
    if (Math.abs(row.amount - candidate.amount) > 0.005) return false;

    const existingKey = descriptionKey(row.description);
    if (!candidateKey || !existingKey) return true;

    return (
      candidateKey.includes(existingKey) || existingKey.includes(candidateKey)
    );
  });
}

// --- Validation ---

/**
 * Turns whatever the model returned into rows that are safe to show the user,
 * discarding anything that fails validation with a reason we can display.
 *
 * Nothing here writes to the database — the user confirms first.
 */
export function validateParsedAlerts(
  rows: RawParsedAlert[],
  today: Date = new Date()
): { alerts: Omit<ParsedAlert, 'category' | 'duplicate'>[]; issues: ParseIssue[] } {
  const alerts: Omit<ParsedAlert, 'category' | 'duplicate'>[] = [];
  const issues: ParseIssue[] = [];

  rows.slice(0, MAX_ALERTS_PER_PASTE).forEach((row, index) => {
    const raw = JSON.stringify(row).slice(0, 200);

    const amount = normaliseAmount(row.amount);
    if (amount === null) {
      issues.push({ index, reason: 'No amount could be read', raw });
      return;
    }
    if (amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
      issues.push({ index, reason: `Amount ${amount} is out of range`, raw });
      return;
    }

    const date = normaliseDate(row.date);
    if (date === null) {
      issues.push({ index, reason: 'No usable date could be read', raw });
      return;
    }
    if (!isPlausibleDate(date, today)) {
      issues.push({ index, reason: `Date ${date} looks wrong`, raw });
      return;
    }

    const description = normaliseDescription(row.description);
    if (description === null) {
      issues.push({ index, reason: 'No description could be read', raw });
      return;
    }

    // Anything not explicitly marked as money in is treated as money out,
    // which is the safer default for a budgeting tool.
    const type = row.type === 'income' ? 'income' : 'expense';

    alerts.push({ date, description, amount, type });
  });

  if (rows.length > MAX_ALERTS_PER_PASTE) {
    issues.push({
      index: MAX_ALERTS_PER_PASTE,
      reason: `Only the first ${MAX_ALERTS_PER_PASTE} alerts were read. Paste the rest separately.`,
      raw: '',
    });
  }

  return { alerts, issues };
}
