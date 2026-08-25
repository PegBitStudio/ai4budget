import { describe, it, expect } from 'vitest';
import { checkAlerts, getActiveAlerts, formatAlertMessage, AlertCheckParams, NewAlert } from './alertEngine';
import { SpendingAlert } from '@/models/alert';
import { Category } from '@/models/category';

describe('checkAlerts', () => {
  const basePeriodStart = '2024-06-01';

  it('generates warning when spending reaches 80% of budget', () => {
    const params: AlertCheckParams = {
      category: 'Groceries',
      categoryTotalSpent: 400, // 80% of 500
      budgetedAmount: 500,
      existingAlerts: [],
      periodStart: basePeriodStart,
    };

    const alerts = checkAlerts(params);

    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe('warning');
    expect(alerts[0].category).toBe('Groceries');
    expect(alerts[0].amount_spent).toBe(400);
    expect(alerts[0].budgeted_amount).toBe(500);
    expect(alerts[0].period_start).toBe(basePeriodStart);
  });

  it('generates exceeded when spending exceeds budget', () => {
    const params: AlertCheckParams = {
      category: 'Dining',
      categoryTotalSpent: 350,
      budgetedAmount: 300,
      existingAlerts: [
        // Warning already exists
        { category: 'Dining', type: 'warning', period_start: basePeriodStart },
      ],
      periodStart: basePeriodStart,
    };

    const alerts = checkAlerts(params);

    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe('exceeded');
    expect(alerts[0].category).toBe('Dining');
    expect(alerts[0].amount_spent).toBe(350);
    expect(alerts[0].budgeted_amount).toBe(300);
  });

  it('does not generate warning if one already exists for this category/period', () => {
    const params: AlertCheckParams = {
      category: 'Groceries',
      categoryTotalSpent: 450,
      budgetedAmount: 500,
      existingAlerts: [
        { category: 'Groceries', type: 'warning', period_start: basePeriodStart },
      ],
      periodStart: basePeriodStart,
    };

    const alerts = checkAlerts(params);

    // Should not generate another warning
    const warnings = alerts.filter((a) => a.type === 'warning');
    expect(warnings).toHaveLength(0);
  });

  it('does not generate exceeded if one already exists for this category/period', () => {
    const params: AlertCheckParams = {
      category: 'Entertainment',
      categoryTotalSpent: 250,
      budgetedAmount: 200,
      existingAlerts: [
        { category: 'Entertainment', type: 'warning', period_start: basePeriodStart },
        { category: 'Entertainment', type: 'exceeded', period_start: basePeriodStart },
      ],
      periodStart: basePeriodStart,
    };

    const alerts = checkAlerts(params);

    expect(alerts).toHaveLength(0);
  });

  it('does not generate any alerts if no budget exists (budgetedAmount is null)', () => {
    const params: AlertCheckParams = {
      category: 'Shopping',
      categoryTotalSpent: 1000,
      budgetedAmount: null,
      existingAlerts: [],
      periodStart: basePeriodStart,
    };

    const alerts = checkAlerts(params);

    expect(alerts).toHaveLength(0);
  });

  it('generates both warning AND exceeded when spending jumps from <80% to >100%', () => {
    const params: AlertCheckParams = {
      category: 'Transport',
      categoryTotalSpent: 550, // >100% of 500
      budgetedAmount: 500,
      existingAlerts: [], // Neither warning nor exceeded exist yet
      periodStart: basePeriodStart,
    };

    const alerts = checkAlerts(params);

    expect(alerts).toHaveLength(2);

    const warning = alerts.find((a) => a.type === 'warning');
    const exceeded = alerts.find((a) => a.type === 'exceeded');

    expect(warning).toBeDefined();
    expect(exceeded).toBeDefined();
    expect(warning!.amount_spent).toBe(550);
    expect(exceeded!.amount_spent).toBe(550);
  });

  it('generates at most one warning and one exceeded per category per period', () => {
    // First call — both get generated
    const params: AlertCheckParams = {
      category: 'Utilities',
      categoryTotalSpent: 220,
      budgetedAmount: 200,
      existingAlerts: [],
      periodStart: basePeriodStart,
    };

    const firstAlerts = checkAlerts(params);
    expect(firstAlerts.filter((a) => a.type === 'warning')).toHaveLength(1);
    expect(firstAlerts.filter((a) => a.type === 'exceeded')).toHaveLength(1);

    // Second call — same category/period, alerts now exist
    const paramsSecond: AlertCheckParams = {
      category: 'Utilities',
      categoryTotalSpent: 250,
      budgetedAmount: 200,
      existingAlerts: [
        { category: 'Utilities', type: 'warning', period_start: basePeriodStart },
        { category: 'Utilities', type: 'exceeded', period_start: basePeriodStart },
      ],
      periodStart: basePeriodStart,
    };

    const secondAlerts = checkAlerts(paramsSecond);
    expect(secondAlerts).toHaveLength(0);
  });

  it('does not trigger warning when spending is below 80%', () => {
    const params: AlertCheckParams = {
      category: 'Housing',
      categoryTotalSpent: 390, // 78% of 500
      budgetedAmount: 500,
      existingAlerts: [],
      periodStart: basePeriodStart,
    };

    const alerts = checkAlerts(params);
    expect(alerts).toHaveLength(0);
  });

  it('triggers warning at exactly 80%', () => {
    const params: AlertCheckParams = {
      category: 'Health',
      categoryTotalSpent: 160, // exactly 80% of 200
      budgetedAmount: 200,
      existingAlerts: [],
      periodStart: basePeriodStart,
    };

    const alerts = checkAlerts(params);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe('warning');
  });

  it('does not trigger exceeded at exactly 100%', () => {
    const params: AlertCheckParams = {
      category: 'Subscriptions',
      categoryTotalSpent: 50, // exactly 100% of 50
      budgetedAmount: 50,
      existingAlerts: [],
      periodStart: basePeriodStart,
    };

    const alerts = checkAlerts(params);
    // Warning should fire (80% threshold met), but exceeded should NOT (not > budget)
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe('warning');
  });

  it('allows alerts for different categories in same period', () => {
    const existingAlerts = [
      { category: 'Groceries' as Category, type: 'warning' as const, period_start: basePeriodStart },
    ];

    const params: AlertCheckParams = {
      category: 'Transport',
      categoryTotalSpent: 250,
      budgetedAmount: 300,
      existingAlerts,
      periodStart: basePeriodStart,
    };

    const alerts = checkAlerts(params);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].category).toBe('Transport');
    expect(alerts[0].type).toBe('warning');
  });

  it('allows same category alert for different period', () => {
    const existingAlerts = [
      { category: 'Groceries' as Category, type: 'warning' as const, period_start: '2024-05-01' },
    ];

    const params: AlertCheckParams = {
      category: 'Groceries',
      categoryTotalSpent: 400,
      budgetedAmount: 500,
      existingAlerts,
      periodStart: basePeriodStart, // Different period
    };

    const alerts = checkAlerts(params);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe('warning');
  });
});

describe('getActiveAlerts', () => {
  const makeMockAlert = (
    overrides: Partial<SpendingAlert> = {}
  ): SpendingAlert => ({
    id: 'alert-1',
    user_id: 'user-1',
    category: 'Groceries',
    type: 'warning',
    amount_spent: 400,
    budgeted_amount: 500,
    period_start: '2024-06-01',
    created_at: '2024-06-15T10:00:00Z',
    ...overrides,
  });

  it('filters alerts to only those for the specified period', () => {
    const alerts: SpendingAlert[] = [
      makeMockAlert({ id: '1', period_start: '2024-06-01' }),
      makeMockAlert({ id: '2', period_start: '2024-05-01' }),
      makeMockAlert({ id: '3', period_start: '2024-06-01' }),
    ];

    const result = getActiveAlerts(alerts, '2024-06-01');
    expect(result).toHaveLength(2);
    expect(result.every((a) => a.period_start === '2024-06-01')).toBe(true);
  });

  it('sorts exceeded alerts before warning alerts', () => {
    const alerts: SpendingAlert[] = [
      makeMockAlert({ id: '1', type: 'warning', created_at: '2024-06-20T10:00:00Z' }),
      makeMockAlert({ id: '2', type: 'exceeded', created_at: '2024-06-15T10:00:00Z' }),
      makeMockAlert({ id: '3', type: 'warning', created_at: '2024-06-18T10:00:00Z' }),
    ];

    const result = getActiveAlerts(alerts, '2024-06-01');
    expect(result[0].type).toBe('exceeded');
    expect(result[1].type).toBe('warning');
    expect(result[2].type).toBe('warning');
  });

  it('within same type, sorts by created_at descending', () => {
    const alerts: SpendingAlert[] = [
      makeMockAlert({ id: '1', type: 'warning', category: 'Groceries', created_at: '2024-06-10T10:00:00Z' }),
      makeMockAlert({ id: '2', type: 'warning', category: 'Transport', created_at: '2024-06-15T10:00:00Z' }),
      makeMockAlert({ id: '3', type: 'warning', category: 'Dining', created_at: '2024-06-12T10:00:00Z' }),
    ];

    const result = getActiveAlerts(alerts, '2024-06-01');
    expect(result[0].id).toBe('2'); // Most recent
    expect(result[1].id).toBe('3');
    expect(result[2].id).toBe('1'); // Oldest
  });

  it('returns empty array when no alerts match the period', () => {
    const alerts: SpendingAlert[] = [
      makeMockAlert({ period_start: '2024-05-01' }),
    ];

    const result = getActiveAlerts(alerts, '2024-06-01');
    expect(result).toHaveLength(0);
  });
});

describe('formatAlertMessage', () => {
  it('formats warning message correctly', () => {
    const message = formatAlertMessage({
      category: 'Groceries',
      type: 'warning',
      amount_spent: 400,
      budgeted_amount: 500,
    });

    expect(message).toBe(
      "⚠️ Groceries: You've spent ₦400.00 of your ₦500.00 budget (80% reached). ₦100.00 left."
    );
  });

  it('formats exceeded message correctly', () => {
    const message = formatAlertMessage({
      category: 'Dining',
      type: 'exceeded',
      amount_spent: 350,
      budgeted_amount: 300,
    });

    expect(message).toBe(
      "🚫 Dining: You've exceeded your ₦300.00 budget by ₦50.00. Spent ₦350.00 total."
    );
  });

  it('formats amounts to 2 decimal places', () => {
    const message = formatAlertMessage({
      category: 'Transport',
      type: 'warning',
      amount_spent: 83.5,
      budgeted_amount: 100,
    });

    expect(message).toContain('₦83.50');
    expect(message).toContain('₦100.00');
    expect(message).toContain('₦16.50');
  });

  it('formats exceeded overage correctly with decimals', () => {
    const message = formatAlertMessage({
      category: 'Shopping',
      type: 'exceeded',
      amount_spent: 155.75,
      budgeted_amount: 150,
    });

    expect(message).toContain('₦5.75'); // overage
    expect(message).toContain('₦155.75'); // total spent
    expect(message).toContain('₦150.00'); // budgeted
  });
});
