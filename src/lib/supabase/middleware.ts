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

  // Every protected route was independently re-validating this exact same
  // session with its own getUser() call — a second full Auth round trip on
  // top of this one, for every single request, multiplied by however many
  // API calls a page fires. Route handlers now read the id from here instead.
  // This header is trustworthy specifically because it is set here, inside
  // middleware, unconditionally overwriting whatever the incoming request
  // carried — a client cannot forge it by sending its own x-user-id.
  const requestHeaders = new Headers(request.headers);
  if (user) {
    requestHeaders.set('x-user-id', user.id);
    // Currency lives in auth user_metadata, not a queryable table — the only
    // other thing routes were calling getUser() a second time just to read.
    const currency = user.user_metadata?.currency;
    if (typeof currency === 'string') {
      requestHeaders.set('x-user-currency', currency);
    } else {
      requestHeaders.delete('x-user-currency');
    }
  } else {
    requestHeaders.delete('x-user-id');
    requestHeaders.delete('x-user-currency');
  }

  const finalResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    finalResponse.cookies.set(cookie);
  });

  return { supabaseResponse: finalResponse, user };
}
