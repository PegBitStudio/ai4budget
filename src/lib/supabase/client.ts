import { createBrowserClient } from '@supabase/ssr';
import { Database } from './types';

/**
 * Creates a Supabase client for use in Client Components.
 * This client runs in the browser and handles auth token storage
 * automatically via cookies.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
