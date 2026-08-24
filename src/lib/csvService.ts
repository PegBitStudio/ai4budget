import Papa from 'papaparse';

/**
 * CSV Service for importing and exporting financial transaction data.
 * Uses PapaParse for parsing with RFC 4180 compliance.
 */

export interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
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
 * Parse a CSV string into validated transactions with error reporting.
 * Columns expected in order: date, description, amount.
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

  const rows = result.data;

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
    const rowNumber = i + 1;
    let rowValid = true;

    // Extract fields: date, description, amount
    const dateStr = row[0]?.trim() ?? '';
    const description = row[1]?.trim() ?? '';
    const amountStr = row[2]?.trim() ?? '';

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
      });
    }
  }

  return { transactions, errors };
}

/**
 * Export transactions to a CSV string with proper formatting.
 * Header row: date,description,amount,category
 * Dates in ISO 8601, amounts with 2 decimal places, RFC 4180 escaping.
 * Transactions ordered by date ascending.
 */
export function exportCSV(transactions: ExportTransaction[]): string {
  // Sort by date ascending
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

  const rows: string[][] = sorted.map((t) => [
    t.date,
    t.description,
    t.amount.toFixed(2),
    t.category,
  ]);

  const csv = Papa.unparse({
    fields: ['date', 'description', 'amount', 'category'],
    data: rows,
  });

  return csv;
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
