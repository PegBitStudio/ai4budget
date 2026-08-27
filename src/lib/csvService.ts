import Papa from 'papaparse';
import { CATEGORIES, type Category } from '@/models/category';

/**
 * CSV Service for importing and exporting financial transaction data.
 * Uses PapaParse for parsing with RFC 4180 compliance.
 */

export interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  /** Present only when the file carried a category column. */
  category?: string;
  /** Defaults to 'expense' when the file carries no type column. */
  type: 'income' | 'expense';
}

export interface CSVError {
  row: number;
  field: string;
  message: string;
}

export interface ExportTransaction {
  date: string;
  description: string;
  amount: number;
  category: string;
  type: 'income' | 'expense';
}

const MAX_ROWS = 10000;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MIN_AMOUNT = 0.01;
const MAX_AMOUNT = 999999999.99;
const MAX_DESCRIPTION_LENGTH = 255;

/**
 * Validates a date string is in YYYY-MM-DD format and represents a valid calendar date.
 */
function isValidDate(dateStr: string): boolean {
  if (!DATE_REGEX.test(dateStr)) return false;
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/**
 * Validates that amount is a positive number within acceptable range.
 */
function isValidAmount(value: string): boolean {
  const num = Number(value);
  if (isNaN(num) || !isFinite(num)) return false;
  if (num < MIN_AMOUNT || num > MAX_AMOUNT) return false;
  return true;
}

/**
 * Detects a header row so files exported from this app — or from a bank,
 * or a spreadsheet — can be imported without hand-editing them first.
 *
 * A header is a first row whose date column is not a date and whose first
 * cell reads like a column name.
 */
function looksLikeHeader(row: string[]): boolean {
  const first = row[0]?.trim().toLowerCase() ?? '';
  if (!first || isValidDate(first)) {
    return false;
  }
  return ['date', 'transaction date', 'txn date', 'value date'].includes(first);
}

/**
 * Parse a CSV string into validated transactions with error reporting.
 *
 * Columns in order: date, description, amount, then optionally category and
 * type. A header row is detected and skipped. Rows with no type column are
 * treated as expenses, which is the safer default for a budgeting tool.
 *
 * Skips invalid rows and accumulates errors with row numbers.
 */
export function parseCSV(csvContent: string): {
  transactions: ParsedTransaction[];
  errors: CSVError[];
} {
  const transactions: ParsedTransaction[] = [];
  const errors: CSVError[] = [];

  const result = Papa.parse<string[]>(csvContent, {
    header: false,
    skipEmptyLines: true,
  });

  let rows = result.data;
  let rowOffset = 0;

  if (rows.length > 0 && looksLikeHeader(rows[0])) {
    rows = rows.slice(1);
    // Keep reported row numbers matching the file the user is looking at.
    rowOffset = 1;
  }

  if (rows.length > MAX_ROWS) {
    errors.push({
      row: 0,
      field: 'file',
      message: `CSV file exceeds maximum of ${MAX_ROWS} rows (found ${rows.length} rows)`,
    });
    return { transactions, errors };
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 1 + rowOffset;
    let rowValid = true;

    // Extract fields: date, description, amount
    const dateStr = row[0]?.trim() ?? '';
    const description = row[1]?.trim() ?? '';
    const amountStr = row[2]?.trim() ?? '';
    const categoryStr = row[3]?.trim() ?? '';
    const typeStr = row[4]?.trim().toLowerCase() ?? '';

    // Validate date
    if (!dateStr) {
      errors.push({ row: rowNumber, field: 'date', message: 'Date is missing' });
      rowValid = false;
    } else if (!isValidDate(dateStr)) {
      errors.push({
        row: rowNumber,
        field: 'date',
        message: 'Date must be in YYYY-MM-DD format and be a valid calendar date',
      });
      rowValid = false;
    }

    // Validate description
    if (!description) {
      errors.push({
        row: rowNumber,
        field: 'description',
        message: 'Description is missing',
      });
      rowValid = false;
    } else if (description.length > MAX_DESCRIPTION_LENGTH) {
      errors.push({
        row: rowNumber,
        field: 'description',
        message: `Description exceeds maximum length of ${MAX_DESCRIPTION_LENGTH} characters`,
      });
      rowValid = false;
    }

    // Validate amount
    if (!amountStr) {
      errors.push({
        row: rowNumber,
        field: 'amount',
        message: 'Amount is missing',
      });
      rowValid = false;
    } else if (!isValidAmount(amountStr)) {
      errors.push({
        row: rowNumber,
        field: 'amount',
        message: `Amount must be a positive number between ${MIN_AMOUNT} and ${MAX_AMOUNT}`,
      });
      rowValid = false;
    }

    if (rowValid) {
      transactions.push({
        date: dateStr,
        description,
        amount: Number(amountStr),
        ...(categoryStr ? { category: categoryStr } : {}),
        type: typeStr === 'income' ? 'income' : 'expense',
      });
    }
  }

  return { transactions, errors };
}

/**
 * Export transactions to a CSV string with proper formatting.
 * Header row: date,description,amount,category,type
 * Dates in ISO 8601, amounts with 2 decimal places, RFC 4180 escaping.
 * Transactions ordered by date ascending.
 *
 * The type column matters: without it a re-imported export would turn every
 * income row into an expense.
 */
export function exportCSV(transactions: ExportTransaction[]): string {
  // Sort by date ascending
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

  const rows: string[][] = sorted.map((t) => [
    t.date,
    escapeCSVFormula(t.description),
    t.amount.toFixed(2),
    t.category,
    t.type,
  ]);

  const csv = Papa.unparse({
    fields: ['date', 'description', 'amount', 'category', 'type'],
    data: rows,
  });

  return csv;
}

/**
 * Neutralises CSV formula injection.
 *
 * A description is free text — typed by the user or extracted by the model
 * from a bank alert — so nothing stops it from starting with `=`, `+`, `-` or
 * `@`. Excel and Sheets both treat a cell starting with one of those as a
 * formula, so "=cmd|'/c calc'!A1" as a transaction description would execute
 * the moment the exported file is opened, not when it was typed. Prefixing
 * such a value with a tab (invisible in the opened sheet) stops it being read
 * as a formula while leaving RFC 4180 quoting to PapaParse as normal.
 */
function escapeCSVFormula(value: string): string {
  return /^[=+\-@]/.test(value) ? `\t${value}` : value;
}

export interface ParsedBudgetRow {
  category: Category;
  amount: number;
}

const MAX_BUDGET_AMOUNT = 999999999.99;

/**
 * Parse a filled-in budget template into category amounts.
 *
 * Columns: category, amount. A header row is detected and skipped, the same
 * way transaction imports handle one, so a template edited in Excel or
 * Sheets — which tends to keep the header — imports without hand-editing.
 * A category is matched case-insensitively so "housing" and "HOUSING" both
 * resolve to "Housing" rather than being rejected as unknown.
 */
export function parseBudgetCSV(csvContent: string): {
  allocations: ParsedBudgetRow[];
  errors: CSVError[];
} {
  const allocations: ParsedBudgetRow[] = [];
  const errors: CSVError[] = [];

  const result = Papa.parse<string[]>(csvContent, {
    header: false,
    skipEmptyLines: true,
  });

  let rows = result.data;
  let rowOffset = 0;

  const first = rows[0]?.[0]?.trim().toLowerCase();
  if (first === 'category') {
    rows = rows.slice(1);
    rowOffset = 1;
  }

  const byLowerCase = new Map<string, Category>(
    CATEGORIES.map((c) => [c.toLowerCase(), c])
  );
  const seen = new Set<Category>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 1 + rowOffset;

    const categoryStr = row[0]?.trim() ?? '';
    const amountStr = row[1]?.trim() ?? '';

    const category = byLowerCase.get(categoryStr.toLowerCase());
    if (!category) {
      errors.push({
        row: rowNumber,
        field: 'category',
        message: categoryStr
          ? `"${categoryStr}" is not one of the budget categories`
          : 'Category is missing',
      });
      continue;
    }

    if (seen.has(category)) {
      errors.push({
        row: rowNumber,
        field: 'category',
        message: `${category} appears more than once — only the first row was used`,
      });
      continue;
    }

    const amount = Number(amountStr);
    if (amountStr === '' || isNaN(amount) || !isFinite(amount) || amount < 0 || amount > MAX_BUDGET_AMOUNT) {
      errors.push({
        row: rowNumber,
        field: 'amount',
        message: `Amount must be a number between 0 and ${MAX_BUDGET_AMOUNT}`,
      });
      continue;
    }

    seen.add(category);
    allocations.push({ category, amount });
  }

  return { allocations, errors };
}

/**
 * The blank template offered for download — every category listed once,
 * ready to fill in.
 */
export function generateBudgetTemplateCSV(): string {
  return Papa.unparse({
    fields: ['category', 'amount'],
    data: CATEGORIES.map((c) => [c, '0']),
  });
}

/**
 * Generate an export filename with today's date.
 * Format: budget_export_YYYY-MM-DD.csv
 */
export function generateExportFilename(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `budget_export_${year}-${month}-${day}.csv`;
}
