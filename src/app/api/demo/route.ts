import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/demo
 * Signs the visitor into the read-only demo account so judges and first-time
 * visitors can explore a populated app without creating an account.
 *
 * Credentials live in server-side env vars and are never sent to the browser.
 */
export async function POST() {
  const email = process.env.DEMO_EMAIL;
  const password = process.env.DEMO_PASSWORD;

  if (!email || !password) {
    return NextResponse.json(
      { error: 'The demo account is not configured on this deployment.' },
      { status: 503 }
    );
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('[POST /api/demo] Sign-in failed:', error.message);
      return NextResponse.json(
        { error: 'Could not open the demo account. Please try signing up instead.' },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[POST /api/demo] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Could not open the demo account. Please try again.' },
      { status: 500 }
    );
  }
}
