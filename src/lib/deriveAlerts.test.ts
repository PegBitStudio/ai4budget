import { describe, it, expect } from 'vitest';
import { deriveAlerts, WARNING_THRESHOLD } from './alertEngine';
import { Category } from '@/models/category';

const PERIOD = '2026-08-01';

function alloc(category: Category, amount: number) {
  return { category, amount };
}

function spent(category: Category, total: number) {
  return { category, total };
}

describe('deriveAlerts', () => {
  it('returns nothing when every category is comfortably inside its plan', () => {
    const alerts = deriveAlerts(
      [alloc('Dining', 30000), alloc('Transport', 45000)],
      [spent('Dining', 10000), spent('Transport', 20000)],
      PERIOD
    );

    expect(alerts).toEqual([]);
  });

  it('warns once spending passes the warning threshold but stays within plan', () => {
    const alerts = deriveAlerts(
      [alloc('Dining', 30000)],
      [spent('Dining', 27000)], // 90%
      PERIOD
    );

    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe('warning');
    expect(alerts[0].percentage).toBeCloseTo(90);
  });

  it('does not warn exactly at the threshold', () => {
    const budget = 30000;
    const alerts = deriveAlerts(
      [alloc('Dining', budget)],
      [spent('Dining', budget * WARNING_THRESHOLD)],
      PERIOD
    );

    expect(alerts).toEqual([]);
  });

  it('reports exceeded once spending passes the allocation', () => {
    const alerts = deriveAlerts(
      [alloc('Shopping', 20000)],
      [spent('Shopping', 300500)],
      PERIOD
    );

    expect(alerts[0].type).toBe('exceeded');
    expect(alerts[0].amount_spent).toBe(300500);
    expect(alerts[0].budgeted_amount).toBe(20000);
    expect(alerts[0].percentage).toBeCloseTo(1502.5);
  });

  it('treats spending exactly at the allocation as a warning, not exceeded', () => {
    const alerts = deriveAlerts(
      [alloc('Housing', 150000)],
      [spent('Housing', 150000)],
      PERIOD
    );

    expect(alerts[0].type).toBe('warning');
  });

  it('surfaces alerts for spending logged before the budget existed', () => {
    // The stored-alert approach missed this entirely: no transaction is
    // inserted after the budget, so no alert was ever written.
    const alerts = deriveAlerts(
      [alloc('Dining', 30000)],
      [spent('Dining', 67050)],
      PERIOD
    );

    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe('exceeded');
  });

  it('sorts exceeded before warning, then by how far past the line', () => {
    const alerts = deriveAlerts(
      [
        alloc('Dining', 30000),
        alloc('Shopping', 20000),
        alloc('Groceries', 70000),
        alloc('Transport', 45000),
      ],
      [
        spent('Dining', 67050), // 224%, exceeded
        spent('Shopping', 300500), // 1503%, exceeded
        spent('Groceries', 66000), // 94%, warning
        spent('Transport', 43000), // 96%, warning
      ],
      PERIOD
    );

    expect(alerts.map((a) => a.category)).toEqual([
      'Shopping',
      'Dining',
      'Transport',
      'Groceries',
    ]);
  });

  it('ignores allocations of zero rather than dividing by it', () => {
    const alerts = deriveAlerts(
      [alloc('Other', 0)],
      [spent('Other', 5000)],
      PERIOD
    );

    expect(alerts).toEqual([]);
  });

  it('treats a category with no spending as absent, not zero-divided', () => {
    const alerts = deriveAlerts(
      [alloc('Health', 10000)],
      [],
      PERIOD
    );

    expect(alerts).toEqual([]);
  });

  it('stamps the given period on every alert', () => {
    const alerts = deriveAlerts(
      [alloc('Shopping', 20000)],
      [spent('Shopping', 300500)],
      PERIOD
    );

    expect(alerts[0].period_start).toBe(PERIOD);
    expect(alerts[0].id).toContain(PERIOD);
  });
});
