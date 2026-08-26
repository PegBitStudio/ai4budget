/**
 * The currency an account keeps its books in.
 *
 * This is a *display* currency, not a conversion. Amounts are stored as plain
 * numbers with no unit attached, so choosing EUR does not turn ₦753,200 into
 * €4,000 — it turns it into €753,200. That is the honest behaviour for a
 * budgeting tool: you record what you spend in the money you spend, and the
 * product never invents an exchange rate it has no business knowing.
 *
 * Which is why the choice belongs at sign-up, and why changing it later has to
 * say plainly what it does and does not do.
 */

export interface Currency {
  code: string;
  symbol: string;
  name: string;
  /** How the assistant should name it in prose. */
  llmName: string;
}

export const CURRENCIES: Currency[] = [
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', llmName: 'Nigerian Naira' },
  { code: 'USD', symbol: '$', name: 'US Dollar', llmName: 'US Dollars' },
  { code: 'EUR', symbol: '€', name: 'Euro', llmName: 'Euros' },
  { code: 'GBP', symbol: '£', name: 'British Pound', llmName: 'British Pounds' },
  { code: 'GHS', symbol: '₵', name: 'Ghanaian Cedi', llmName: 'Ghanaian Cedis' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling', llmName: 'Kenyan Shillings' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand', llmName: 'South African Rand' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', llmName: 'Canadian Dollars' },
];

export const DEFAULT_CURRENCY_CODE = 'NGN';

export const DEFAULT_CURRENCY: Currency = CURRENCIES[0];

export function currencyByCode(code: string | null | undefined): Currency {
  if (!code) return DEFAULT_CURRENCY;
  return CURRENCIES.find((c) => c.code === code) ?? DEFAULT_CURRENCY;
}

export function currencySymbol(code: string | null | undefined): string {
  return currencyByCode(code).symbol;
}
