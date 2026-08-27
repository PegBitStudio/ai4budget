import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Updates the Supabase auth session by refreshing expired tokens.
 * Call this from the Next.js middleware to keep sessions alive.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the auth token — this is the key call that keeps sessions alive.
  // Do not remove this line or wrap it in a condition. Always call getUser()
  // so expired tokens get refreshed before reaching server components/routes.
  //
  // This runs on every request to a protected route, in Edge Middleware,
  // ahead of every page and API route. A getUser() call that hangs — a slow
  // or briefly unreachable Auth API — used to hang the middleware itself,
  // and Vercel turns that into a GATEWAY_TIMEOUT on the entire site, not just
  // the one request. Racing it against a timeout means a bad moment for the
  // Auth API degrades to "signed out" for that request instead of taking the
  // whole app down; RLS on every table is the real access boundary regardless
  // of what this function decides.
  const user = await Promise.race([
    supabase.auth.getUser().then(({ data }) => data.user),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
  ]);

  return { supabaseResponse, user };
}
