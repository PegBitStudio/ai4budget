import { describe, it, expect } from 'vitest';
import {
  parseCSV,
  exportCSV,
  generateExportFilename,
  parseBudgetCSV,
  generateBudgetTemplateCSV,
  ExportTransaction,
} from './csvService';
import { CATEGORIES } from '@/models/category';

describe('csvService', () => {
  describe('parseCSV', () => {
    it('should parse valid CSV with multiple rows', () => {
      const csv = [
        '2024-01-15,Groceries at Woolworths,45.99',
        '2024-02-01,Monthly rent,1200.00',
        '2024-03-10,Coffee shop,5.50',
      ].join('\n');

      const { transactions, errors } = parseCSV(csv);

      expect(errors).toHaveLength(0);
      expect(transactions).toHaveLength(3);
      expect(transactions[0]).toEqual({
        date: '2024-01-15',
        description: 'Groceries at Woolworths',
        amount: 45.99,
        type: 'expense',
      });
      expect(transactions[1]).toEqual({
        date: '2024-02-01',
        description: 'Monthly rent',
        amount: 1200.0,
        type: 'expense',
      });
      expect(transactions[2]).toEqual({
        date: '2024-03-10',
        description: 'Coffee shop',
        amount: 5.5,
        type: 'expense',
      });
    });

    it('should report errors for rows with missing fields', () => {
      const csv = [
        '2024-01-15,,45.99',
        ',Groceries,45.99',
        '2024-01-15,Groceries,',
      ].join('\n');

      const { transactions, errors } = parseCSV(csv);

      expect(transactions).toHaveLength(0);
      expect(errors).toHaveLength(3);

      expect(errors[0]).toEqual({
        row: 1,
        field: 'description',
        message: 'Description is missing',
      });
      expect(errors[1]).toEqual({
        row: 2,
        field: 'date',
        message: 'Date is missing',
      });
      expect(errors[2]).toEqual({
        row: 3,
        field: 'amount',
        message: 'Amount is missing',
      });
    });

    it('should report errors for invalid amounts', () => {
      const csv = [
        '2024-01-15,Item A,-5.00',
        '2024-01-15,Item B,0',
        '2024-01-15,Item C,abc',
        '2024-01-15,Item D,1000000000.00',
      ].join('\n');

      const { transactions, errors } = parseCSV(csv);

      expect(transactions).toHaveLength(0);
      expect(errors).toHaveLength(4);
      errors.forEach((err) => {
        expect(err.field).toBe('amount');
      });
    });

    it('should report errors for invalid dates', () => {
      const csv = [
        '15-01-2024,Item A,10.00',
        '2024-13-01,Item B,20.00',
        '2024-02-30,Item C,30.00',
        'not-a-date,Item D,40.00',
      ].join('\n');

      const { transactions, errors } = parseCSV(csv);

      expect(transactions).toHaveLength(0);
      expect(errors).toHaveLength(4);
      errors.forEach((err) => {
        expect(err.field).toBe('date');
      });
    });

    it('should reject CSV exceeding 10,000 rows', () => {
      const rows = Array.from(
        { length: 10001 },
        (_, i) => `2024-01-01,Item ${i},10.00`
      );
      const csv = rows.join('\n');

      const { transactions, errors } = parseCSV(csv);

      expect(transactions).toHaveLength(0);
      expect(errors).toHaveLength(1);
      expect(errors[0].field).toBe('file');
      expect(errors[0].message).toContain('exceeds maximum');
    });

    it('should skip invalid rows and keep valid ones', () => {
      const csv = [
        '2024-01-15,Valid item,25.00',
        '2024-13-01,Invalid date,10.00',
        '2024-02-20,Another valid,99.99',
      ].join('\n');

      const { transactions, errors } = parseCSV(csv);

      expect(transactions).toHaveLength(2);
      expect(errors).toHaveLength(1);
      expect(transactions[0].description).toBe('Valid item');
      expect(transactions[1].description).toBe('Another valid');
    });

    it('should reject descriptions exceeding 255 characters', () => {
      const longDesc = 'A'.repeat(256);
      const csv = `2024-01-15,${longDesc},10.00`;

      const { transactions, errors } = parseCSV(csv);

      expect(transactions).toHaveLength(0);
      expect(errors).toHaveLength(1);
      expect(errors[0].field).toBe('description');
    });

    it('should handle empty CSV content', () => {
      const { transactions, errors } = parseCSV('');

      expect(transactions).toHaveLength(0);
      expect(errors).toHaveLength(0);
    });
  });

  describe('exportCSV', () => {
    it('should export transactions with proper formatting', () => {
      const transactions: ExportTransaction[] = [
        { date: '2024-03-10', description: 'Coffee', amount: 5.5, category: 'Dining', type: 'expense' },
        { date: '2024-01-15', description: 'Rent', amount: 1200, category: 'Housing', type: 'expense' },
      ];

      const csv = exportCSV(transactions);
      const lines = csv.split('\r\n');

      // Header row
      expect(lines[0]).toBe('date,description,amount,category,type');
      // Sorted by date ascending, amounts with 2 decimal places
      expect(lines[1]).toBe('2024-01-15,Rent,1200.00,Housing,expense');
      expect(lines[2]).toBe('2024-03-10,Coffee,5.50,Dining,expense');
    });

    it('should handle descriptions with commas (RFC 4180 escaping)', () => {
      const transactions: ExportTransaction[] = [
        {
          date: '2024-01-15',
          description: 'Groceries, snacks, and drinks',
          amount: 45.99,
          category: 'Groceries',
          type: 'expense',
        },
      ];

      const csv = exportCSV(transactions);
      const lines = csv.split('\r\n');

      // Field with commas should be quoted
      expect(lines[1]).toBe('2024-01-15,"Groceries, snacks, and drinks",45.99,Groceries,expense');
    });

    it('should handle descriptions with double quotes (RFC 4180 escaping)', () => {
      const transactions: ExportTransaction[] = [
        {
          date: '2024-01-15',
          description: 'The "best" coffee',
          amount: 6.0,
          category: 'Dining',
          type: 'expense',
        },
      ];

      const csv = exportCSV(transactions);
      const lines = csv.split('\r\n');

      // Quotes inside field are escaped by doubling and the field is quoted
      expect(lines[1]).toBe('2024-01-15,"The ""best"" coffee",6.00,Dining,expense');
    });

    it('should return empty CSV with just headers for empty transactions', () => {
      const csv = exportCSV([]);
      const lines = csv.split('\r\n');

      expect(lines[0]).toBe('date,description,amount,category,type');
      // No data rows (PapaParse may return just the header)
      expect(lines.length).toBeLessThanOrEqual(2);
      if (lines.length === 2) {
        expect(lines[1]).toBe('');
      }
    });

    it('should order transactions by date ascending', () => {
      const transactions: ExportTransaction[] = [
        { date: '2024-03-01', description: 'Third', amount: 30, category: 'Other', type: 'expense' },
        { date: '2024-01-01', description: 'First', amount: 10, category: 'Other', type: 'expense' },
        { date: '2024-02-01', description: 'Second', amount: 20, category: 'Other', type: 'expense' },
      ];

      const csv = exportCSV(transactions);
      const lines = csv.split('\r\n');

      expect(lines[1]).toContain('First');
      expect(lines[2]).toContain('Second');
      expect(lines[3]).toContain('Third');
    });

    // A description is free text — typed by a user, or extracted by the model
    // from a bank alert — so nothing stops it starting with a character Excel
    // and Sheets read as the start of a formula. Left alone, opening the
    // exported file would execute it.
    it.each(['=SUM(A1:A9)', '+1+1', '-2+3', '@SUM(1,2)'])(
      'neutralises a description starting with %s',
      (formula) => {
        const transactions: ExportTransaction[] = [
          { date: '2024-01-15', description: formula, amount: 10, category: 'Other', type: 'expense' },
        ];

        // Read back through the real parser rather than splitting on commas by
        // hand — the formula itself may contain a comma, which RFC 4180
        // quotes, and a naive split would cut the field in the wrong place.
        const { transactions: parsed } = parseCSV(exportCSV(transactions));
        const raw = exportCSV(transactions);

        expect(raw).not.toContain(`,${formula[0]}`);
        // The escape is a leading tab, invisible once opened and trimmed away
        // on re-import — not a visible change to the description itself.
        expect(parsed[0].description).toBe(formula);
      }
    );

    it('leaves an ordinary description untouched', () => {
      const transactions: ExportTransaction[] = [
        { date: '2024-01-15', description: 'Shoprite', amount: 10, category: 'Groceries', type: 'expense' },
      ];

      const csv = exportCSV(transactions);
      expect(csv.split('\r\n')[1]).toBe('2024-01-15,Shoprite,10.00,Groceries,expense');
    });

    it('round-trips a formula-shaped description back to its original text', () => {
      const original: ExportTransaction[] = [
        { date: '2024-01-15', description: '=SUM(A1:A9)', amount: 10, category: 'Other', type: 'expense' },
      ];

      // parseCSV trims each field, which is what removes the tab the export
      // added — the value that comes back in is exactly what went out.
      const { transactions } = parseCSV(exportCSV(original));
      expect(transactions[0].description).toBe('=SUM(A1:A9)');
    });
  });

  describe('generateExportFilename', () => {
    it('should return filename with today\'s date in expected format', () => {
      const filename = generateExportFilename();
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');

      expect(filename).toBe(`budget_export_${year}-${month}-${day}.csv`);
    });

    it('should match the expected pattern', () => {
      const filename = generateExportFilename();
      expect(filename).toMatch(/^budget_export_\d{4}-\d{2}-\d{2}\.csv$/);
    });
  });

  describe('header handling', () => {
    it('skips a header row', () => {
      const csv = [
        'date,description,amount',
        '2024-01-15,Rent,1200.00',
      ].join('\n');

      const { transactions, errors } = parseCSV(csv);

      expect(errors).toHaveLength(0);
      expect(transactions).toHaveLength(1);
      expect(transactions[0].description).toBe('Rent');
    });

    it('reports row numbers against the file the user is looking at', () => {
      const csv = [
        'date,description,amount',
        '2024-01-15,Rent,1200.00',
        'not-a-date,Broken,50.00',
      ].join('\n');

      const { errors } = parseCSV(csv);

      // The bad row is the third line of the file, not the second data row.
      expect(errors[0].row).toBe(3);
    });

    it('does not mistake a data row for a header', () => {
      const csv = '2024-01-15,Rent,1200.00';
      expect(parseCSV(csv).transactions).toHaveLength(1);
    });
  });

  describe('optional category and type columns', () => {
    it('reads a category when the file provides one', () => {
      const { transactions } = parseCSV('2024-01-15,Rent,1200.00,Housing');
      expect(transactions[0].category).toBe('Housing');
    });

    it('leaves category unset when the file has only three columns', () => {
      const { transactions } = parseCSV('2024-01-15,Rent,1200.00');
      expect(transactions[0].category).toBeUndefined();
    });

    it('reads income from the type column', () => {
      const { transactions } = parseCSV('2024-01-25,Salary,450000.00,Other,income');
      expect(transactions[0].type).toBe('income');
    });

    it('treats a row with no type column as an expense', () => {
      const { transactions } = parseCSV('2024-01-15,Rent,1200.00');
      expect(transactions[0].type).toBe('expense');
    });

    it('treats an unrecognised type as an expense', () => {
      const { transactions } = parseCSV('2024-01-15,Rent,1200.00,Housing,DR');
      expect(transactions[0].type).toBe('expense');
    });
  });

  describe('round trip: export then parse', () => {
    it('preserves date, description, amount, category and type', () => {
      // Before the type column existed, re-importing an export silently turned
      // every income row into an expense.
      const original: ExportTransaction[] = [
        { date: '2024-01-15', description: 'Rent payment', amount: 1200, category: 'Housing', type: 'expense' },
        { date: '2024-01-20', description: 'Groceries', amount: 85.5, category: 'Groceries', type: 'expense' },
        { date: '2024-02-01', description: 'Salary', amount: 450000, category: 'Other', type: 'income' },
      ];

      // The export is fed straight back in, header and all.
      const { transactions, errors } = parseCSV(exportCSV(original));

      expect(errors).toHaveLength(0);
      expect(transactions).toEqual([
        { date: '2024-01-15', description: 'Rent payment', amount: 1200, category: 'Housing', type: 'expense' },
        { date: '2024-01-20', description: 'Groceries', amount: 85.5, category: 'Groceries', type: 'expense' },
        { date: '2024-02-01', description: 'Salary', amount: 450000, category: 'Other', type: 'income' },
      ]);
    });

    it('survives descriptions containing commas and quotes', () => {
      const original: ExportTransaction[] = [
        {
          date: '2024-01-15',
          description: 'The "best" coffee, twice',
          amount: 6,
          category: 'Dining',
          type: 'expense',
        },
      ];

      const { transactions } = parseCSV(exportCSV(original));

      expect(transactions[0].description).toBe('The "best" coffee, twice');
    });
  });

  describe('parseBudgetCSV', () => {
    it('parses category,amount rows', () => {
      const csv = 'Housing,150000\nGroceries,70000';
      const { allocations, errors } = parseBudgetCSV(csv);

      expect(errors).toHaveLength(0);
      expect(allocations).toEqual([
        { category: 'Housing', amount: 150000 },
        { category: 'Groceries', amount: 70000 },
      ]);
    });

    it('skips a header row', () => {
      const csv = 'category,amount\nHousing,150000';
      const { allocations, errors } = parseBudgetCSV(csv);

      expect(errors).toHaveLength(0);
      expect(allocations).toEqual([{ category: 'Housing', amount: 150000 }]);
    });

    it('matches a category case-insensitively', () => {
      const { allocations, errors } = parseBudgetCSV('housing,1000');
      expect(errors).toHaveLength(0);
      expect(allocations[0].category).toBe('Housing');
    });

    it('rejects a category that is not one of the ten', () => {
      const { allocations, errors } = parseBudgetCSV('Rent,1000');
      expect(allocations).toHaveLength(0);
      expect(errors).toHaveLength(1);
      expect(errors[0].field).toBe('category');
    });

    it('rejects a negative or non-numeric amount', () => {
      const { allocations, errors } = parseBudgetCSV('Housing,-5\nGroceries,abc');
      expect(allocations).toHaveLength(0);
      expect(errors).toHaveLength(2);
    });

    it('keeps only the first row for a repeated category', () => {
      const { allocations, errors } = parseBudgetCSV('Housing,1000\nHousing,2000');
      expect(allocations).toEqual([{ category: 'Housing', amount: 1000 }]);
      expect(errors).toHaveLength(1);
    });
  });

  describe('generateBudgetTemplateCSV', () => {
    it('lists every category once with a zero amount', () => {
      const { allocations, errors } = parseBudgetCSV(generateBudgetTemplateCSV());
      expect(errors).toHaveLength(0);
      expect(allocations).toHaveLength(CATEGORIES.length);
      expect(allocations.every((a) => a.amount === 0)).toBe(true);
    });
  });
});
