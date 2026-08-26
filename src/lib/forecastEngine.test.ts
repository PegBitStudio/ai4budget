import { describe, it, expect } from 'vitest';
import {
  forecastCategories,
  getPeriodProgress,
  describeForecast,
  type ForecastInput,
} from './forecastEngine';
import { Category } from '@/models/category';

const PERIOD = { periodStart: '2026-08-01', periodEnd: '2026-08-31' };

/** A steady drip of small amounts — the shape a run rate can actually read. */
function steady(count: number, each: number): number[] {
  return Array.from({ length: count }, () => each);
}

function build(overrides: Partial<ForecastInput> = {}): ForecastInput {
  return {
    allocations: [{ category: 'Dining' as Category, amount: 30_000 }],
    transactionsByCategory: { Dining: steady(6, 2_000) },
    today: '2026-08-15',
    ...PERIOD,
    ...overrides,
  };
}

describe('getPeriodProgress', () => {
  it('counts today as elapsed, because today has already happened', () => {
    expect(getPeriodProgress('2026-08-01', '2026-08-31', '2026-08-01')).toEqual({
      elapsedDays: 1,
      totalDays: 31,
      daysRemaining: 30,
    });
  });

  it('measures a full month', () => {
    const p = getPeriodProgress('2026-08-01', '2026-08-31', '2026-08-31');
    expect(p.totalDays).toBe(31);
    expect(p.elapsedDays).toBe(31);
    expect(p.daysRemaining).toBe(0);
  });

  it('handles a week', () => {
    const p = getPeriodProgress('2026-08-10', '2026-08-16', '2026-08-12');
    expect(p.totalDays).toBe(7);
    expect(p.elapsedDays).toBe(3);
    expect(p.daysRemaining).toBe(4);
  });

  it('clamps a date past the end rather than projecting beyond it', () => {
    const p = getPeriodProgress('2026-08-01', '2026-08-31', '2026-09-20');
    expect(p.elapsedDays).toBe(31);
    expect(p.daysRemaining).toBe(0);
  });

  it('clamps a date before the start rather than going negative', () => {
    const p = getPeriodProgress('2026-08-01', '2026-08-31', '2026-07-20');
    expect(p.elapsedDays).toBe(0);
  });
});

describe('forecastCategories — when it will speak', () => {
  it('projects a steady rate past the budget', () => {
    // ₦12,000 over 15 of 31 days → about ₦24,800 projected, under ₦30,000.
    const [f] = forecastCategories(build());
    expect(f.usable).toBe(true);
    expect(f.projected).toBeCloseTo(24_800, 0);
    expect(f.verdict).toBe('on-track');
  });

  it('calls a category that will run over', () => {
    const [f] = forecastCategories(
      build({ transactionsByCategory: { Dining: steady(8, 2_500) } })
    );
    // ₦20,000 over 15 days → ₦41,333 projected against ₦30,000.
    expect(f.verdict).toBe('will-exceed');
    expect(f.projectedOverspend).toBeGreaterThan(11_000);
  });

  it('flags a category heading for the line without crossing it', () => {
    // Tuned to land just inside the budget but past 90% of it.
    const [f] = forecastCategories(
      build({ transactionsByCategory: { Dining: steady(7, 2_050) } })
    );
    expect(f.verdict).toBe('close');
    expect(f.projectedOverspend).toBe(0);
  });

  it('still projects a category that has already gone over', () => {
    // Six ₦6,000 dinners by the 15th: ₦36,000 against a ₦30,000 plan, already
    // over — and heading for about ₦74,400 by the end of the month. Knowing
    // the second number is the reason to change anything.
    const [f] = forecastCategories(
      build({ transactionsByCategory: { Dining: steady(6, 6_000) } })
    );
    expect(f.verdict).toBe('exceeded');
    expect(f.projectedOverspend).toBe(6_000); // the fact, not the projection
    expect(f.projected).toBeCloseTo(74_400, 0);
    expect(describeForecast(f, 16)).toMatch(/finishes around/i);
  });

  it('does not invent a projection for an over category it cannot read', () => {
    // One big purchase: already over, but the rate is an illusion.
    const [f] = forecastCategories(
      build({ transactionsByCategory: { Dining: [40_000] } })
    );
    expect(f.verdict).toBe('exceeded');
    expect(f.projected).toBe(f.spentSoFar);
    expect(f.reason).toBe('too-few-transactions');
    expect(describeForecast(f, 16)).not.toMatch(/finishes around/i);
  });

  it('reports an overspend that already happened as fact, not forecast', () => {
    const [f] = forecastCategories(
      build({ transactionsByCategory: { Dining: steady(4, 9_000) } })
    );
    expect(f.verdict).toBe('exceeded');
    expect(f.projectedOverspend).toBe(6_000);
    expect(f.usable).toBe(true);
  });
});

describe('forecastCategories — when it stays quiet', () => {
  it('says nothing in the first quarter of the period', () => {
    const [f] = forecastCategories(build({ today: '2026-08-05' }));
    expect(f.usable).toBe(false);
    expect(f.reason).toBe('too-early');
  });

  it('will not read a rate from one or two transactions', () => {
    const [f] = forecastCategories(
      build({ transactionsByCategory: { Dining: [4_000, 3_000] } })
    );
    expect(f.usable).toBe(false);
    expect(f.reason).toBe('too-few-transactions');
  });

  it('refuses to project when one purchase dominates the category', () => {
    // Rent on the 1st would otherwise project to twice the month's rent.
    const [f] = forecastCategories({
      ...build(),
      allocations: [{ category: 'Housing' as Category, amount: 150_000 }],
      transactionsByCategory: { Housing: [140_000, 3_000, 2_000] },
    });
    expect(f.usable).toBe(false);
    expect(f.reason).toBe('one-off-dominates');
  });

  it('ignores a category with no budget to measure against', () => {
    const [f] = forecastCategories(
      build({ allocations: [{ category: 'Dining' as Category, amount: 0 }] })
    );
    expect(f.usable).toBe(false);
    expect(f.reason).toBe('no-budget');
  });

  it('handles a category with no spending at all', () => {
    const [f] = forecastCategories(
      build({ transactionsByCategory: {} })
    );
    expect(f.spentSoFar).toBe(0);
    expect(f.usable).toBe(false);
  });

  it('never reports an overspend it is not confident about', () => {
    const quiet = forecastCategories(build({ today: '2026-08-03' }));
    for (const f of quiet) {
      expect(f.projectedOverspend).toBe(0);
    }
  });
});

describe('forecastCategories — ordering', () => {
  it('puts what has already gone before what is about to', () => {
    const forecasts = forecastCategories({
      ...PERIOD,
      today: '2026-08-15',
      allocations: [
        { category: 'Dining' as Category, amount: 30_000 },
        { category: 'Transport' as Category, amount: 20_000 },
        { category: 'Groceries' as Category, amount: 50_000 },
      ],
      transactionsByCategory: {
        Dining: steady(8, 2_500), // will exceed
        Transport: steady(4, 6_000), // already exceeded
        Groceries: steady(5, 2_000), // on track
      },
    });

    expect(forecasts.map((f) => f.verdict)).toEqual([
      'exceeded',
      'will-exceed',
      'on-track',
    ]);
  });
});

describe('describeForecast', () => {
  it('speaks conditionally about a projection', () => {
    const [f] = forecastCategories(
      build({ transactionsByCategory: { Dining: steady(8, 2_500) } })
    );
    const sentence = describeForecast(f, 16);
    expect(sentence).toMatch(/at this rate/i);
    expect(sentence).toContain('16 days');
  });

  it('speaks in the past tense about an overspend that happened', () => {
    const [f] = forecastCategories(
      build({ transactionsByCategory: { Dining: steady(4, 9_000) } })
    );
    expect(describeForecast(f, 16)).toMatch(/already/i);
  });

  it('gets the singular right on the last day', () => {
    const [f] = forecastCategories(
      build({ transactionsByCategory: { Dining: steady(8, 2_500) } })
    );
    expect(describeForecast(f, 1)).toContain('1 day');
    expect(describeForecast(f, 1)).not.toContain('1 days');
  });
});
