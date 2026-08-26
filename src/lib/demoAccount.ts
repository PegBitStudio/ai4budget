import { createClient } from '@/lib/supabase/server';

/**
 * Whether the caller is signed into the shared demo account.
 *
 * The demo is one Supabase user that every visitor is signed into, which is
 * what makes "no signup needed" possible — and also what makes it fragile.
 * Anyone exploring it is editing the same rows as everyone else, so the one
 * action that cannot be allowed there is the irreversible one: wiping every
 * transaction, budget and goal would leave the next visitor an empty product
 * and make the figures quoted on the landing page describe data that no longer
 * exists.
 *
 * Ordinary edits stay allowed. Adding a transaction is the most convincing
 * thing a first-time visitor can do, it is recoverable, and blocking it would
 * cost more than it saves.
 */
export async function isDemoAccount(): Promise<boolean> {
  const demoEmail = process.env.DEMO_EMAIL;
  if (!demoEmail) return false;

  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    const email = data.user?.email;
    if (!email) return false;

    return email.toLowerCase() === demoEmail.toLowerCase();
  } catch {
    // Failing closed here would lock a real user out of their own delete, so
    // an unreadable session is treated as "not the demo".
    return false;
  }
}

/** The message shown wherever the demo account is held back from something. */
export const DEMO_BLOCKED_MESSAGE =
  'This is the shared demo account, so deleting everything is turned off — the next visitor would find an empty app. Create your own account to try it.';
