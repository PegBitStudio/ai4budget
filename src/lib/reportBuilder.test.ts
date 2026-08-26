import { describe, it, expect } from 'vitest';
import {
  buildReport,
  REPORT_KINDS,
  type ReportTransaction,
  type BuildReportInput,
} from './reportBuilder';
import { Category } from '@/models/category';

const TRANSACTIONS: ReportTransaction[] = [
  { amount: 450_000, type: 'income', category: 'Other', date: '2026-08-25', description: 'Salary' },
  { amount: 85_000, type: 'income', category: 'Other', date: '2026-08-14', description: 'Freelance' },
  { amount: 150_000, type: 'expense', category: 'Housing', date: '2026-08-01', description: 'Rent' },
  { amount: 20_000, type: 'expense', category: 'Dining', date: '2026-08-09', description: 'Dinner' },
  { amount: 10_000, type: 'expense', category: 'Dining', date: '2026-08-16', description: 'Lunch' },
  { amount: 30_000, type: 'expense', category: 'Transport', date: '2026-08-23', description: 'Fuel' },
];

function build(overrides: Partial<BuildReportInput> = {}) {
  return buildReport({
    kind: 'monthly-summary',
    transactions: TRANSACTIONS,
    allocations: [
      { category: 'Housing' as Category, amount: 150_000 },
      { category: 'Dining' as Category, amount: 25_000 },
      { category: 'Transport' as Category, amount: 45_000 },
    ],
    periodStart: '2026-08-01',
    periodEnd: '2026-08-31',
    periodLabel: 'August 2026',
    ...overrides,
  });
}

describe('every report kind', () => {
  it('builds without throwing and carries a headline', () => {
    for (const { kind } of REPORT_KINDS) {
      const report = build({ kind });
      expect(report.headline.length).toBeGreaterThan(0);
      expect(report.title.length).toBeGreaterThan(0);
      expect(report.periodLabel).toBe('August 2026');
    }
  });

  it('survives a period with nothing in it', () => {
    for (const { kind } of REPORT_KINDS) {
      const report = build({ kind, transactions: [], allocations: [] });
      expect(report.headline.length).toBeGreaterThan(0);
      expect(() => JSON.stringify(report)).not.toThrow();
    }
  });

  it('reports the same in/out strip on every kind', () => {
    for (const { kind } of REPORT_KINDS) {
      const report = build({ kind });
      expect(report.summary[0]).toEqual({ label: 'Money in', value: '₦535,000.00' });
      expect(report.summary[1]).toEqual({ label: 'Money out', value: '₦210,000.00' });
    }
  });
});

describe('monthly summary', () => {
  it('states the saving rate when there is one', () => {
    const report = build({ kind: 'monthly-summary' });
    // 535,000 in, 210,000 out → 325,000 kept, 61%.
    expect(report.headline).toContain('₦325,000.00');
    expect(report.headline).toContain('61%');
  });

  it('says short, not saved, when spending overran income', () => {
    const report = build({
      kind: 'monthly-summary',
      transactions: [
        { amount: 100_000, type: 'income', category: 'Other', date: '2026-08-01', description: 'Salary' },
        { amount: 150_000, type: 'expense', category: 'Housing', date: '2026-08-02', description: 'Rent' },
      ],
    });
    expect(report.headline).toContain('more than you earned');
    expect(report.summary[2].label).toBe('Short by');
    expect(report.summary[2].value).toBe('₦50,000.00');
  });

  it('handles spending exactly matching income', () => {
    const report = build({
      kind: 'monthly-summary',
      transactions: [
        { amount: 50_000, type: 'income', category: 'Other', date: '2026-08-01', description: 'Salary' },
        { amount: 50_000, type: 'expense', category: 'Housing', date: '2026-08-02', description: 'Rent' },
      ],
    });
    expect(report.headline).toContain('exactly what you earned');
  });
});

describe('spending by category', () => {
  it('ranks categories largest first with their share', () => {
    const report = build({ kind: 'spending-by-category' });
    const lines = report.sections[0].lines;

    expect(lines.map((l) => l.label)).toEqual(['Housing', 'Dining', 'Transport']);
    expect(lines[0].value).toBe(150_000);
    // 150,000 of 210,000
    expect(lines[0].share).toBeCloseTo(71.43, 1);
  });

  it('adds the two Dining transactions into one line', () => {
    const report = build({ kind: 'spending-by-category' });
    const dining = report.sections[0].lines.find((l) => l.label === 'Dining');
    expect(dining?.value).toBe(30_000);
  });

  it('shares sum to 100', () => {
    const report = build({ kind: 'spending-by-category' });
    const total = report.sections[0].lines.reduce(
      (sum, line) => sum + (line.share ?? 0),
      0
    );
    expect(total).toBeCloseTo(100, 0);
  });
});

describe('income', () => {
  it('lists each source', () => {
    const report = build({ kind: 'income' });
    expect(report.sections[0].lines.map((l) => l.label)).toEqual([
      'Salary',
      'Freelance',
    ]);
  });

  it('says so plainly when nothing came in', () => {
    const report = build({
      kind: 'income',
      transactions: TRANSACTIONS.filter((t) => t.type === 'expense'),
    });
    expect(report.headline).toBe('No income was recorded for this period.');
  });
});

describe('cash flow', () => {
  it('counts weeks from the start of the period, not from Monday', () => {
    const report = build({ kind: 'cash-flow' });
    const labels = report.sections[0].lines.map((l) => l.label);
    expect(labels[0]).toBe('Week 1');
    // Rent on the 1st lands in week 1 and nothing else does.
    expect(report.sections[0].lines[0].value).toBe(-150_000);
  });

  it('nets income against spending inside a week', () => {
    const report = build({
      kind: 'cash-flow',
      transactions: [
        { amount: 100_000, type: 'income', category: 'Other', date: '2026-08-02', description: 'Salary' },
        { amount: 40_000, type: 'expense', category: 'Dining', date: '2026-08-03', description: 'Dinner' },
      ],
    });
    expect(report.sections[0].lines[0].value).toBe(60_000);
  });

  it('ignores a transaction dated before the period began', () => {
    const report = build({
      kind: 'cash-flow',
      transactions: [
        { amount: 9_000, type: 'expense', category: 'Dining', date: '2026-07-28', description: 'Old' },
      ],
    });
    expect(report.sections[0].lines).toHaveLength(0);
  });
});

describe('budget performance', () => {
  it('puts the worst overspend first and signs it correctly', () => {
    const report = build({ kind: 'budget-performance' });
    const lines = report.sections[0].lines;

    // Dining: 30,000 spent against 25,000 → +5,000.
    expect(lines[0]).toMatchObject({ label: 'Dining', value: 5_000 });
    // Transport: 30,000 against 45,000 → 15,000 under.
    expect(lines.find((l) => l.label === 'Transport')?.value).toBe(-15_000);
  });

  it('names how many categories went over', () => {
    expect(build({ kind: 'budget-performance' }).headline).toContain(
      '1 of 3 categories'
    );
  });

  it('says everything held when nothing went over', () => {
    const report = build({
      kind: 'budget-performance',
      allocations: [{ category: 'Dining' as Category, amount: 90_000 }],
    });
    expect(report.headline).toContain('inside its plan');
  });

  it('does not pretend to compare when no budget exists', () => {
    const report = build({ kind: 'budget-performance', allocations: [] });
    expect(report.headline).toContain('No budget was set');
  });

  it('reports usage as a percentage of the plan', () => {
    const report = build({ kind: 'budget-performance' });
    const dining = report.sections[0].lines.find((l) => l.label === 'Dining');
    expect(dining?.share).toBe(120);
  });
});
