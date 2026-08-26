/**
 * Display formatting utilities for currency, percentages, and numbers.
 */

const FALLBACK_SYMBOL = '₦';

/**
 * The symbol this browser is currently displaying money in.
 *
 * Deliberately module-level, and deliberately client-only. One browser serves
 * one signed-in account, so a single value is correct there and saves threading
 * a symbol through a hundred call sites. On the server the same process serves
 * every user at once, so a shared mutable symbol would be a data leak waiting
 * for two concurrent requests — which is why `activeSymbol()` refuses to read it
 * there and server code must pass the symbol explicitly.
 */
let clientSymbol = FALLBACK_SYMBOL;

export function setActiveCurrencySymbol(symbol: string): void {
  if (typeof window === 'undefined') return;
  clientSymbol = symbol || FALLBACK_SYMBOL;
}

export function activeSymbol(): string {
  return typeof window === 'undefined' ? FALLBACK_SYMBOL : clientSymbol;
}

/**
 * Formats a number as currency.
 *
 * With no symbol given it uses whatever this browser is set to, and the Naira
 * fallback on the server. Server code that builds a user-facing string must
 * pass the symbol rather than rely on the default.
 *
 * @example formatCurrency(1234.56) => "₦1,234.56"
 * @example formatCurrency(1234.56, '$') => "$1,234.56"
 */
export function formatCurrency(amount: number, symbol: string = activeSymbol()): string {
  const formatted = Math.abs(amount)
    .toFixed(2)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  const sign = amount < 0 ? '-' : '';
  return `${sign}${symbol}${formatted}`;
}

/**
 * Formats a number as a percentage string.
 *
 * @example formatPercentage(12.567) => "12.6%"
 * @example formatPercentage(12.567, 2) => "12.57%"
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Formats large numbers in compact notation (1.2K, 3.4M, etc.).
 * Numbers below 1000 are returned as-is with up to 1 decimal place.
 *
 * @example formatCompactNumber(1234) => "1.2K"
 * @example formatCompactNumber(3456789) => "3.5M"
 * @example formatCompactNumber(500) => "500"
 */
export function formatCompactNumber(amount: number): string {
  const absAmount = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  if (absAmount >= 1_000_000_000) {
    return `${sign}${(absAmount / 1_000_000_000).toFixed(1)}B`;
  }
  if (absAmount >= 1_000_000) {
    return `${sign}${(absAmount / 1_000_000).toFixed(1)}M`;
  }
  if (absAmount >= 1_000) {
    return `${sign}${(absAmount / 1_000).toFixed(1)}K`;
  }

  return `${sign}${absAmount}`;
}
