import { describe, it, expect } from 'vitest';
import {
  parseListQuery,
  sanitiseSearch,
  SORTABLE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from './transactionQuery';

const q = (s: string) => parseListQuery(new URLSearchParams(s));

describe('parseListQuery — sorting', () => {
  it('defaults to newest first', () => {
    const parsed = q('');
    expect(parsed.sort).toBe('date');
    expect(parsed.ascending).toBe(false);
  });

  it.each(SORTABLE)('accepts %s as a sort column', (col) => {
    expect(q(`sort=${col}`).sort).toBe(col);
  });

  it('falls back to date when asked to sort on a column not in the allowlist', () => {
    // The value is interpolated into the database query, so anything outside
    // the allowlist must not survive.
    expect(q('sort=user_id').sort).toBe('date');
    expect(q('sort=id').sort).toBe('date');
    expect(q('sort=amount.desc,user_id').sort).toBe('date');
    expect(q('sort=').sort).toBe('date');
  });

  it('only reads dir=asc as ascending', () => {
    expect(q('dir=asc').ascending).toBe(true);
    expect(q('dir=desc').ascending).toBe(false);
    expect(q('dir=ASC').ascending).toBe(false);
    expect(q('dir=1').ascending).toBe(false);
  });
});

describe('sanitiseSearch', () => {
  it('keeps an ordinary merchant search intact', () => {
    expect(sanitiseSearch('Chicken Republic')).toBe('Chicken Republic');
  });

  it('trims surrounding whitespace', () => {
    expect(sanitiseSearch('  bolt  ')).toBe('bolt');
  });

  it('returns null for nothing to search on', () => {
    expect(sanitiseSearch(null)).toBeNull();
    expect(sanitiseSearch('')).toBeNull();
    expect(sanitiseSearch('   ')).toBeNull();
  });

  it('strips the characters that would end the filter value', () => {
    // A comma or a closing bracket terminates a PostgREST filter, so a search
    // box could otherwise append conditions of its own.
    const cleaned = sanitiseSearch('a,description.ilike.*)');
    expect(cleaned).not.toContain(',');
    expect(cleaned).not.toContain(')');
    expect(cleaned).not.toContain('*');
  });

  it('strips the wildcards, so one keystroke cannot match everything', () => {
    expect(sanitiseSearch('*')).toBeNull();
    expect(sanitiseSearch('%')).toBeNull();
    expect(sanitiseSearch('a%b')).toBe('a b');
  });

  it('reduces a search made only of syntax to nothing', () => {
    expect(sanitiseSearch(',,,')).toBeNull();
  });
});

describe('parseListQuery — paging', () => {
  it('defaults to one page from the start', () => {
    expect(q('')).toMatchObject({ limit: DEFAULT_LIMIT, offset: 0 });
  });

  it('caps an absurd page size', () => {
    expect(q('limit=99999999').limit).toBe(MAX_LIMIT);
  });

  it('leaves the dashboard whole-history fetch untouched', () => {
    // The dashboard totals every transaction client-side. Clamping that
    // request would under-report someone's spending without saying so.
    expect(q('limit=10000').limit).toBe(10000);
  });

  it('refuses a page size below one', () => {
    expect(q('limit=0').limit).toBe(1);
    expect(q('limit=-5').limit).toBe(1);
  });

  it('refuses a negative offset', () => {
    expect(q('offset=-10').offset).toBe(0);
  });

  it('falls back when the numbers are not numbers', () => {
    expect(q('limit=all&offset=first')).toMatchObject({
      limit: DEFAULT_LIMIT,
      offset: 0,
    });
  });
});

describe('parseListQuery — filters', () => {
  it('reads the filters it is given', () => {
    expect(q('category=Dining&from=2026-08-01&to=2026-08-31&type=expense')).toMatchObject({
      category: 'Dining',
      from: '2026-08-01',
      to: '2026-08-31',
      type: 'expense',
    });
  });

  it('ignores a type that is neither income nor expense', () => {
    expect(q('type=transfer').type).toBeNull();
  });

  it('treats empty filters as absent rather than as a value to match', () => {
    expect(q('category=&from=&to=')).toMatchObject({
      category: null,
      from: null,
      to: null,
    });
  });
});
