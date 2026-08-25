import { describe, it, expect } from 'vitest';
import {
  normaliseAmount,
  normaliseDate,
  isPlausibleDate,
  normaliseDescription,
  isDuplicate,
  validateParsedAlerts,
  MAX_ALERTS_PER_PASTE,
  chunkAlertText,
} from './alertParser';

const TODAY = new Date(2026, 7, 25); // 25 August 2026

describe('normaliseAmount', () => {
  it.each([
    ['NGN5,000.00', 5000],
    ['₦ 12,000', 12000],
    ['NGN 1,500.00 DR', 1500],
    ['NGN 3,200.50 CR', 3200.5],
    ['naira 250', 250],
    ['3200', 3200],
    ['1,234,567.89', 1234567.89],
  ])('reads %s as %d', (input, expected) => {
    expect(normaliseAmount(input)).toBe(expected);
  });

  it('accepts a plain number', () => {
    expect(normaliseAmount(4800)).toBe(4800);
  });

  it('treats a debit written as negative as a positive amount', () => {
    // Direction is carried by `type`, never by the sign.
    expect(normaliseAmount('-2500.00')).toBe(2500);
    expect(normaliseAmount(-2500)).toBe(2500);
  });

  it.each([null, undefined, '', 'no digits here', {}, NaN, Infinity])(
    'returns null for %s',
    (input) => {
      expect(normaliseAmount(input)).toBeNull();
    }
  );
});

describe('normaliseDate', () => {
  it.each([
    ['2026-08-12', '2026-08-12'],
    ['2026-08-12T09:14:00Z', '2026-08-12'],
    ['12-AUG-2026', '2026-08-12'],
    ['12 Aug 2026', '2026-08-12'],
    ['12-Aug-26', '2026-08-12'],
    ['4 Aug 2026', '2026-08-04'],
    ['Aug 4, 2026', '2026-08-04'],
    ['August 4 2026', '2026-08-04'],
    ['4th August 2026', '2026-08-04'],
    ['02-Sept-2026', '2026-09-02'],
  ])('reads %s as %s', (input, expected) => {
    expect(normaliseDate(input)).toBe(expected);
  });

  it('reads ambiguous numeric dates day-first, as Nigerian alerts write them', () => {
    expect(normaliseDate('05/08/2026')).toBe('2026-08-05');
    expect(normaliseDate('05.08.2026')).toBe('2026-08-05');
  });

  it('swaps to month-first only when day-first is impossible', () => {
    // 08/13 cannot be day 8 month 13, so it must be month 8 day 13.
    expect(normaliseDate('08/13/2026')).toBe('2026-08-13');
  });

  it('keeps day-first when the day is unambiguous', () => {
    expect(normaliseDate('13/08/2026')).toBe('2026-08-13');
  });

  it('rejects dates that are not real calendar days', () => {
    expect(normaliseDate('31-FEB-2026')).toBeNull();
    expect(normaliseDate('2026-02-30')).toBeNull();
    expect(normaliseDate('32/01/2026')).toBeNull();
  });

  it.each([null, undefined, '', 'sometime last week', 42])(
    'returns null for %s',
    (input) => {
      expect(normaliseDate(input)).toBeNull();
    }
  );
});

describe('isPlausibleDate', () => {
  it('accepts today and the recent past', () => {
    expect(isPlausibleDate('2026-08-25', TODAY)).toBe(true);
    expect(isPlausibleDate('2026-06-01', TODAY)).toBe(true);
    expect(isPlausibleDate('2024-01-15', TODAY)).toBe(true);
  });

  it('allows a day of slack for timezone skew', () => {
    expect(isPlausibleDate('2026-08-26', TODAY)).toBe(true);
  });

  it('rejects dates well into the future', () => {
    expect(isPlausibleDate('2026-12-01', TODAY)).toBe(false);
  });

  it('rejects a misread year in the distant past', () => {
    expect(isPlausibleDate('2016-08-12', TODAY)).toBe(false);
  });
});

describe('normaliseDescription', () => {
  it('collapses whitespace and trims separator noise', () => {
    expect(normaliseDescription('  POS/WEB   PURCHASE/BOLT/  ')).toBe(
      'POS/WEB PURCHASE/BOLT'
    );
  });

  it('truncates to the column limit', () => {
    const long = 'a'.repeat(400);
    expect(normaliseDescription(long)).toHaveLength(255);
  });

  it.each([null, undefined, '', '   ', 7])('returns null for %s', (input) => {
    expect(normaliseDescription(input)).toBeNull();
  });
});

describe('isDuplicate', () => {
  const existing = [
    { date: '2026-08-12', amount: 4550, description: 'Bolt ride to work' },
    { date: '2026-08-02', amount: 38000, description: 'Shoprite monthly stock-up' },
  ];

  it('flags the same payment written slightly differently', () => {
    expect(
      isDuplicate(
        { date: '2026-08-12', amount: 4550, description: 'BOLT RIDE TO WORK' },
        existing
      )
    ).toBe(true);
  });

  it('flags a narration that contains the stored description', () => {
    expect(
      isDuplicate(
        { date: '2026-08-02', amount: 38000, description: 'Shoprite monthly stock-up (POS)' },
        existing
      )
    ).toBe(true);
  });

  it('does not flag the same amount on a different day', () => {
    expect(
      isDuplicate(
        { date: '2026-08-13', amount: 4550, description: 'Bolt ride to work' },
        existing
      )
    ).toBe(false);
  });

  it('does not flag a different amount on the same day', () => {
    expect(
      isDuplicate(
        { date: '2026-08-12', amount: 4551, description: 'Bolt ride to work' },
        existing
      )
    ).toBe(false);
  });

  it('does not flag an unrelated merchant on the same day and amount', () => {
    expect(
      isDuplicate(
        { date: '2026-08-12', amount: 4550, description: 'Chicken Republic' },
        existing
      )
    ).toBe(false);
  });

  it('returns false against an empty ledger', () => {
    expect(
      isDuplicate(
        { date: '2026-08-12', amount: 4550, description: 'Bolt' },
        []
      )
    ).toBe(false);
  });
});

describe('validateParsedAlerts', () => {
  it('accepts a well-formed row', () => {
    const { alerts, issues } = validateParsedAlerts(
      [
        {
          date: '12-AUG-2026',
          description: 'POS/WEB PURCHASE/BOLT',
          amount: 'NGN4,550.00',
          type: 'expense',
        },
      ],
      TODAY
    );

    expect(issues).toEqual([]);
    expect(alerts).toEqual([
      {
        date: '2026-08-12',
        description: 'POS/WEB PURCHASE/BOLT',
        amount: 4550,
        type: 'expense',
      },
    ]);
  });

  it('keeps income marked as income', () => {
    const { alerts } = validateParsedAlerts(
      [
        {
          date: '2026-08-28',
          description: 'Salary',
          amount: 450000,
          type: 'income',
        },
      ],
      new Date(2026, 7, 29)
    );

    expect(alerts[0].type).toBe('income');
  });

  it('defaults an unrecognised type to expense', () => {
    // Money out is the safer assumption for a budgeting tool.
    const { alerts } = validateParsedAlerts(
      [{ date: '2026-08-12', description: 'Bolt', amount: 4550, type: 'DR' }],
      TODAY
    );

    expect(alerts[0].type).toBe('expense');
  });

  it('drops rows with an unreadable amount, date or description', () => {
    const { alerts, issues } = validateParsedAlerts(
      [
        { date: '2026-08-12', description: 'Bolt', amount: 'balance enquiry' },
        { date: 'whenever', description: 'Bolt', amount: 4550 },
        { date: '2026-08-12', description: '   ', amount: 4550 },
      ],
      TODAY
    );

    expect(alerts).toEqual([]);
    expect(issues).toHaveLength(3);
    expect(issues[0].reason).toMatch(/amount/i);
    expect(issues[1].reason).toMatch(/date/i);
    expect(issues[2].reason).toMatch(/description/i);
  });

  it('drops a row whose date is implausible rather than storing it', () => {
    const { alerts, issues } = validateParsedAlerts(
      [{ date: '2031-08-12', description: 'Bolt', amount: 4550 }],
      TODAY
    );

    expect(alerts).toEqual([]);
    expect(issues[0].reason).toMatch(/looks wrong/i);
  });

  it('rejects an amount outside the storable range', () => {
    const { alerts, issues } = validateParsedAlerts(
      [{ date: '2026-08-12', description: 'Bolt', amount: 0.001 }],
      TODAY
    );

    expect(alerts).toEqual([]);
    expect(issues[0].reason).toMatch(/out of range/i);
  });

  it('keeps the good rows when only some are bad', () => {
    const { alerts, issues } = validateParsedAlerts(
      [
        { date: '2026-08-12', description: 'Bolt', amount: 4550 },
        { date: 'nonsense', description: 'Broken', amount: 100 },
        { date: '2026-08-13', description: 'Shoprite', amount: 14500 },
      ],
      TODAY
    );

    expect(alerts.map((a) => a.description)).toEqual(['Bolt', 'Shoprite']);
    expect(issues).toHaveLength(1);
  });

  it('caps a very large paste and says so', () => {
    const rows = Array.from({ length: MAX_ALERTS_PER_PASTE + 5 }, () => ({
      date: '2026-08-12',
      description: 'Bolt',
      amount: 4550,
    }));

    const { alerts, issues } = validateParsedAlerts(rows, TODAY);

    expect(alerts).toHaveLength(MAX_ALERTS_PER_PASTE);
    expect(issues.at(-1)?.reason).toMatch(/first 200/i);
  });

  it('returns nothing for an empty model response', () => {
    expect(validateParsedAlerts([], TODAY)).toEqual({ alerts: [], issues: [] });
  });
});

describe('chunkAlertText', () => {
  const block = (n: number) => `Debit Alert\nAmount: NGN ${n}00.00\nDesc: MERCHANT ${n}`;

  it('returns nothing for empty input', () => {
    expect(chunkAlertText('')).toEqual([]);
    expect(chunkAlertText('   \n\n  ')).toEqual([]);
  });

  it('keeps a single alert in one batch', () => {
    expect(chunkAlertText(block(1))).toEqual([block(1)]);
  });

  it('keeps a multi-line alert intact rather than splitting mid-alert', () => {
    const [batch] = chunkAlertText(block(1));
    expect(batch).toContain('Debit Alert');
    expect(batch).toContain('Desc: MERCHANT 1');
  });

  it('groups blank-line separated alerts into batches', () => {
    const text = [1, 2, 3, 4, 5, 6, 7, 8].map(block).join('\n\n');
    const batches = chunkAlertText(text, 3);

    expect(batches).toHaveLength(3);
    expect(batches[0].split('Debit Alert')).toHaveLength(4); // 3 alerts
    expect(batches[2]).toContain('MERCHANT 8');
  });

  it('loses no alert across the batch boundaries', () => {
    const text = [1, 2, 3, 4, 5, 6, 7].map(block).join('\n\n');
    const joined = chunkAlertText(text, 2).join('\n\n');

    for (const n of [1, 2, 3, 4, 5, 6, 7]) {
      expect(joined).toContain(`MERCHANT ${n}`);
    }
  });

  it('splits on lines when the paste has no blank lines at all', () => {
    const text = Array.from(
      { length: 14 },
      (_, i) => `Access Bank: NGN ${i}00.00 DR MERCHANT ${i} 19/08/2026`
    ).join('\n');

    const batches = chunkAlertText(text, 1);

    expect(batches.length).toBeGreaterThan(1);
    expect(batches.join('\n')).toContain('MERCHANT 13');
  });

  it('leaves a short blank-line-free paste as one batch', () => {
    const text = 'Access Bank: NGN 900.00 DR HEALTHPLUS 19/08/2026\nBal: NGN 12,000';
    expect(chunkAlertText(text)).toEqual([text]);
  });
});
