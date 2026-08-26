import { createClient } from '@/lib/supabase/server';
import { currencyByCode, type Currency } from '@/config/currencies';

/**
 * The signed-in account's currency, resolved per request.
 *
 * Deliberately a function rather than a module-level value: one server process
 * serves every account at once, so anything cached at module scope would sooner
 * or later show one user another user's money.
 */
export async function getUserCurrency(): Promise<Currency> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return currencyByCode(data.user?.user_metadata?.currency as string | undefined);
  } catch {
    return currencyByCode(null);
  }
}
