import { describe, it, expect } from 'vitest';
import {
  CURRENCIES,
  DEFAULT_CURRENCY,
  DEFAULT_CURRENCY_CODE,
  currencyByCode,
  currencySymbol,
} from './currencies';
import { formatCurrency } from '@/utils/formatters';

describe('the currency list', () => {
  it('defaults to Naira, which is what this product was built for', () => {
    expect(DEFAULT_CURRENCY_CODE).toBe('NGN');
    expect(DEFAULT_CURRENCY.symbol).toBe('₦');
  });

  it('gives every currency a code, a symbol and both names', () => {
    for (const currency of CURRENCIES) {
      expect(currency.code).toMatch(/^[A-Z]{3}$/);
      expect(currency.symbol.length).toBeGreaterThan(0);
      expect(currency.name.length).toBeGreaterThan(0);
      expect(currency.llmName.length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate codes', () => {
    const codes = new Set(CURRENCIES.map((c) => c.code));
    expect(codes.size).toBe(CURRENCIES.length);
  });
});

describe('currencyByCode', () => {
  it('finds a currency it knows', () => {
    expect(currencyByCode('EUR').symbol).toBe('€');
    expect(currencyByCode('GBP').symbol).toBe('£');
  });

  // An unknown or missing code must never blank the symbol: an amount with no
  // currency in front of it is worse than one in the wrong currency.
  it.each([null, undefined, '', 'XYZ', 'ngn'])(
    'falls back to the default for %s',
    (code) => {
      expect(currencyByCode(code)).toEqual(DEFAULT_CURRENCY);
    }
  );

  it('never returns an empty symbol', () => {
    expect(currencySymbol('nonsense').length).toBeGreaterThan(0);
  });
});

describe('formatting in another currency', () => {
  it('relabels rather than converts, which is the honest behaviour', () => {
    // The same number, three ways. No exchange rate is applied anywhere,
    // because this product has no business inventing one.
    expect(formatCurrency(753_200, '₦')).toBe('₦753,200.00');
    expect(formatCurrency(753_200, '$')).toBe('$753,200.00');
    expect(formatCurrency(753_200, '€')).toBe('€753,200.00');
  });

  it('keeps the sign outside the symbol', () => {
    expect(formatCurrency(-218_200, '€')).toBe('-€218,200.00');
  });

  it('handles a multi-character symbol', () => {
    expect(formatCurrency(1_000, currencySymbol('KES'))).toBe('KSh1,000.00');
  });

  it('groups thousands whatever the currency', () => {
    for (const currency of CURRENCIES) {
      expect(formatCurrency(1_234_567.89, currency.symbol)).toContain(
        '1,234,567.89'
      );
    }
  });
});

describe('the server default', () => {
  // The formatter keeps a mutable symbol for the browser, where one process
  // serves one account. On the server the same process serves everybody, so
  // reading that value would eventually show one user another user's money.
  it('falls back to Naira when nothing is passed', () => {
    expect(formatCurrency(1_000)).toBe('₦1,000.00');
  });
});
