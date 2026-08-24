import { describe, it, expect } from 'vitest';
import {
  parseCSV,
  exportCSV,
  generateExportFilename,
  ExportTransaction,
} from './csvService';

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
      });
      expect(transactions[1]).toEqual({
        date: '2024-02-01',
        description: 'Monthly rent',
        amount: 1200.0,
      });
      expect(transactions[2]).toEqual({
        date: '2024-03-10',
        description: 'Coffee shop',
        amount: 5.5,
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
        { date: '2024-03-10', description: 'Coffee', amount: 5.5, category: 'Dining' },
        { date: '2024-01-15', description: 'Rent', amount: 1200, category: 'Housing' },
      ];

      const csv = exportCSV(transactions);
      const lines = csv.split('\r\n');

      // Header row
      expect(lines[0]).toBe('date,description,amount,category');
      // Sorted by date ascending, amounts with 2 decimal places
      expect(lines[1]).toBe('2024-01-15,Rent,1200.00,Housing');
      expect(lines[2]).toBe('2024-03-10,Coffee,5.50,Dining');
    });

    it('should handle descriptions with commas (RFC 4180 escaping)', () => {
      const transactions: ExportTransaction[] = [
        {
          date: '2024-01-15',
          description: 'Groceries, snacks, and drinks',
          amount: 45.99,
          category: 'Groceries',
        },
      ];

      const csv = exportCSV(transactions);
      const lines = csv.split('\r\n');

      // Field with commas should be quoted
      expect(lines[1]).toBe('2024-01-15,"Groceries, snacks, and drinks",45.99,Groceries');
    });

    it('should handle descriptions with double quotes (RFC 4180 escaping)', () => {
      const transactions: ExportTransaction[] = [
        {
          date: '2024-01-15',
          description: 'The "best" coffee',
          amount: 6.0,
          category: 'Dining',
        },
      ];

      const csv = exportCSV(transactions);
      const lines = csv.split('\r\n');

      // Quotes inside field are escaped by doubling and the field is quoted
      expect(lines[1]).toBe('2024-01-15,"The ""best"" coffee",6.00,Dining');
    });

    it('should return empty CSV with just headers for empty transactions', () => {
      const csv = exportCSV([]);
      const lines = csv.split('\r\n');

      expect(lines[0]).toBe('date,description,amount,category');
      // No data rows (PapaParse may return just the header)
      expect(lines.length).toBeLessThanOrEqual(2);
      if (lines.length === 2) {
        expect(lines[1]).toBe('');
      }
    });

    it('should order transactions by date ascending', () => {
      const transactions: ExportTransaction[] = [
        { date: '2024-03-01', description: 'Third', amount: 30, category: 'Other' },
        { date: '2024-01-01', description: 'First', amount: 10, category: 'Other' },
        { date: '2024-02-01', description: 'Second', amount: 20, category: 'Other' },
      ];

      const csv = exportCSV(transactions);
      const lines = csv.split('\r\n');

      expect(lines[1]).toContain('First');
      expect(lines[2]).toContain('Second');
      expect(lines[3]).toContain('Third');
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

  describe('round trip: export then parse', () => {
    it('should produce equivalent data when exported and re-imported', () => {
      const original: ExportTransaction[] = [
        { date: '2024-01-15', description: 'Rent payment', amount: 1200, category: 'Housing' },
        { date: '2024-01-20', description: 'Groceries', amount: 85.5, category: 'Groceries' },
        { date: '2024-02-01', description: 'Electric bill', amount: 120.75, category: 'Utilities' },
      ];

      // Export to CSV
      const csv = exportCSV(original);

      // Remove header row before parsing (parseCSV expects no header)
      const lines = csv.split('\r\n');
      const dataOnly = lines.slice(1).join('\n');

      // Parse back (note: parseCSV expects 3 columns: date, description, amount)
      // The exported CSV has 4 columns, so we need to test the round-trip differently
      // We'll manually validate the structure
      const { transactions, errors } = parseCSV(dataOnly);

      // The parser reads columns 0,1,2 as date,description,amount
      // Since export has date,description,amount,category (4 cols),
      // columns 0,1,2 still map correctly
      expect(errors).toHaveLength(0);
      expect(transactions).toHaveLength(3);

      // Sorted by date ascending (already sorted in export)
      expect(transactions[0].date).toBe('2024-01-15');
      expect(transactions[0].description).toBe('Rent payment');
      expect(transactions[0].amount).toBe(1200.0);

      expect(transactions[1].date).toBe('2024-01-20');
      expect(transactions[1].description).toBe('Groceries');
      expect(transactions[1].amount).toBe(85.5);

      expect(transactions[2].date).toBe('2024-02-01');
      expect(transactions[2].description).toBe('Electric bill');
      expect(transactions[2].amount).toBe(120.75);
    });
  });
});
