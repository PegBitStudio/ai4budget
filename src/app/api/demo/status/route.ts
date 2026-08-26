import { NextResponse } from 'next/server';
import { isDemoAccount } from '@/lib/demoAccount';

export const dynamic = 'force-dynamic';

/**
 * GET /api/demo/status
 *
 * Whether the caller is signed into the shared demo account. The interface uses
 * this to stop offering an action the server would refuse anyway — a button
 * that always errors is worse than no button.
 *
 * The guard itself lives on the destructive endpoint; this is only for
 * presentation, and tells the caller nothing they do not already know about
 * the account they are signed into.
 */
export async function GET() {
  return NextResponse.json({ isDemo: await isDemoAccount() }, { status: 200 });
}
