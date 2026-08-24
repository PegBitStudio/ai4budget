/**
 * Display formatting utilities for currency, percentages, and numbers.
 */

/**
 * Formats a number as currency with the given symbol.
 * Defaults to "₦" (Naira) symbol. Pass a different symbol for other currencies.
 *
 * @example formatCurrency(1234.56) => "₦1,234.56"
 * @example formatCurrency(1234.56, '$') => "$1,234.56"
 */
export function formatCurrency(amount: number, symbol: string = '₦'): string {
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
