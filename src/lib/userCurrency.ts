import { currencyByCode, type Currency } from '@/config/currencies';

/**
 * The signed-in account's currency.
 *
 * Reads the value middleware already extracted from the validated session —
 * this used to call getUser() again itself, a second Auth round trip for a
 * value the request already carried by the time a route handler runs it.
 */
export function getUserCurrency(currencyHeader: string | null): Currency {
  return currencyByCode(currencyHeader ?? undefined);
}
