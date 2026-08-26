import { describe, it, expect } from 'vitest';
import {
  buildNotifications,
  countUnread,
  MAX_NOTIFICATIONS,
  type NotificationInput,
} from './notifications';
import { Category } from '@/models/category';
import type { CategoryForecast } from './forecastEngine';

const EMPTY: NotificationInput = {
  alerts: [],
  forecasts: [],
  anomalies: [],
  risingCategories: [],
  periodStart: '2026-08-01',
  daysRemaining: 16,
};

function exceededAlert(category: string, spent: number, budget: number) {
  return {
    id: `${category}-2026-08-01`,
    category: category as Category,
    type: 'exceeded' as const,
    amount_spent: spent,
    budgeted_amount: budget,
    period_start: '2026-08-01',
    percentage: (spent / budget) * 100,
  };
}

function warningAlert(category: string, spent: number, budget: number) {
  return { ...exceededAlert(category, spent, budget), type: 'warning' as const };
}

function willExceed(category: string): CategoryForecast {
  return {
    category: category as Category,
    budgeted: 30_000,
    spentSoFar: 20_000,
    projected: 41_333,
    projectedOverspend: 11_333,
    verdict: 'will-exceed',
    usable: true,
  };
}

describe('buildNotifications', () => {
  it('returns nothing when nothing has happened', () => {
    expect(buildNotifications(EMPTY)).toEqual([]);
  });

  it('reports an overspend as critical', () => {
    const [n] = buildNotifications({
      ...EMPTY,
      alerts: [exceededAlert('Dining', 67_050, 30_000)],
    });
    expect(n.severity).toBe('critical');
    expect(n.kind).toBe('budget-exceeded');
    expect(n.body).toContain('₦37,050.00');
  });

  it('reports approaching a limit as a warning, not a crisis', () => {
    const [n] = buildNotifications({
      ...EMPTY,
      alerts: [warningAlert('Transport', 18_000, 20_000)],
    });
    expect(n.severity).toBe('warning');
    expect(n.kind).toBe('budget-approaching');
  });

  it('turns a forecast into a warning while there is still time', () => {
    const [n] = buildNotifications({
      ...EMPTY,
      forecasts: [willExceed('Dining')],
    });
    expect(n.kind).toBe('budget-forecast');
    expect(n.body).toMatch(/at this rate/i);
    expect(n.body).toContain('16 days');
  });

  it('ignores a forecast it is not confident about', () => {
    const unusable = { ...willExceed('Dining'), usable: false };
    expect(buildNotifications({ ...EMPTY, forecasts: [unusable] })).toEqual([]);
  });

  it('ignores a forecast for a category that is merely on track', () => {
    const fine = { ...willExceed('Dining'), verdict: 'on-track' as const };
    expect(buildNotifications({ ...EMPTY, forecasts: [fine] })).toEqual([]);
  });

  it('does not warn that a category will go over when it already has', () => {
    const notifications = buildNotifications({
      ...EMPTY,
      alerts: [exceededAlert('Dining', 67_050, 30_000)],
      forecasts: [willExceed('Dining')],
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].kind).toBe('budget-exceeded');
  });

  it('still forecasts a different category than the one already over', () => {
    const notifications = buildNotifications({
      ...EMPTY,
      alerts: [exceededAlert('Shopping', 300_500, 20_000)],
      forecasts: [willExceed('Dining')],
    });
    expect(notifications.map((n) => n.kind)).toEqual([
      'budget-exceeded',
      'budget-forecast',
    ]);
  });

  it('carries unusual transactions and rising categories as information', () => {
    const notifications = buildNotifications({
      ...EMPTY,
      anomalies: [
        {
          transaction: {
            id: 'tx-1',
            amount: 285_000,
            category: 'Shopping' as Category,
            date: '2026-08-22',
            description: 'Slot - replacement phone',
          },
          categoryAverage: 15_500,
          multiple: 18.4,
        },
      ],
      risingCategories: [
        {
          category: 'Dining' as Category,
          previousAmount: 40_000,
          currentAmount: 67_050,
          percentageChange: 67.6,
        },
      ],
    });

    expect(notifications.map((n) => n.kind)).toEqual([
      'unusual-spend',
      'category-rising',
    ]);
    expect(notifications[0].body).toContain('18.4×');
    expect(notifications[1].body).toContain('68%');
  });
});

describe('ranking', () => {
  it('puts what has gone wrong above what might', () => {
    const notifications = buildNotifications({
      ...EMPTY,
      alerts: [
        warningAlert('Transport', 18_000, 20_000),
        exceededAlert('Shopping', 300_500, 20_000),
      ],
      forecasts: [willExceed('Dining')],
      risingCategories: [
        {
          category: 'Utilities' as Category,
          previousAmount: 40_000,
          currentAmount: 47_750,
          percentageChange: 19.4,
        },
      ],
    });

    expect(notifications.map((n) => n.severity)).toEqual([
      'critical',
      'warning',
      'warning',
      'info',
    ]);
  });

  it('puts the thing you can still act on first among equals', () => {
    const notifications = buildNotifications({
      ...EMPTY,
      alerts: [warningAlert('Transport', 18_000, 20_000)],
      forecasts: [willExceed('Dining')],
    });
    // Both are warnings; the forecast still has days left to run.
    expect(notifications[0].kind).toBe('budget-forecast');
  });

  it('caps the list so it stays readable', () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      exceededAlert(`Cat${i}`, 1_000, 500)
    );
    expect(buildNotifications({ ...EMPTY, alerts: many })).toHaveLength(
      MAX_NOTIFICATIONS
    );
  });
});

describe('identity', () => {
  it('gives the same subject the same id every time', () => {
    const input = { ...EMPTY, alerts: [exceededAlert('Dining', 67_050, 30_000)] };
    expect(buildNotifications(input)[0].id).toBe(
      buildNotifications(input)[0].id
    );
    expect(buildNotifications(input)[0].id).toBe('budget-exceeded:Dining:2026-08-01');
  });

  it('gives next period its own id, so a dismissed alert comes back', () => {
    const august = buildNotifications({
      ...EMPTY,
      alerts: [exceededAlert('Dining', 67_050, 30_000)],
    })[0];
    const september = buildNotifications({
      ...EMPTY,
      periodStart: '2026-09-01',
      alerts: [
        { ...exceededAlert('Dining', 67_050, 30_000), period_start: '2026-09-01' },
      ],
    })[0];

    expect(september.id).not.toBe(august.id);
  });

  it('never emits the same id twice in one feed', () => {
    const notifications = buildNotifications({
      ...EMPTY,
      alerts: [
        exceededAlert('Dining', 67_050, 30_000),
        exceededAlert('Dining', 67_050, 30_000),
      ],
    });
    expect(notifications).toHaveLength(1);
  });
});

describe('countUnread', () => {
  it('counts everything when nothing has been read', () => {
    const notifications = buildNotifications({
      ...EMPTY,
      alerts: [exceededAlert('Dining', 67_050, 30_000)],
    });
    expect(countUnread(notifications, [])).toBe(1);
  });

  it('stops counting what has been dismissed', () => {
    const notifications = buildNotifications({
      ...EMPTY,
      alerts: [exceededAlert('Dining', 67_050, 30_000)],
    });
    expect(countUnread(notifications, [notifications[0].id])).toBe(0);
  });

  it('ignores stale ids from a previous period', () => {
    const notifications = buildNotifications({
      ...EMPTY,
      alerts: [exceededAlert('Dining', 67_050, 30_000)],
    });
    expect(countUnread(notifications, ['budget-exceeded:Dining:2026-07-01'])).toBe(1);
  });
});
