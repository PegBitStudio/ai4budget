import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

/**
 * Public routes that do not require authentication.
 * Requests to these paths skip the auth redirect logic.
 */
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  // Reachable while signed in on purpose: the emailed link puts the visitor
  // into a short-lived recovery session, so they arrive here authenticated and
  // must not be bounced to the dashboard before setting the new password.
  '/reset-password',
  '/offline',
  '/manifest.webmanifest',
  '/sw.js',
  '/apple-touch-icon.png',
  // Next's file-convention OG image. Without this, WhatsApp, Instagram and
  // every other link-preview crawler hit the auth redirect and fetched the
  // login page HTML instead of an image — the shared link would have shown
  // no preview at all.
  '/opengraph-image',
  '/twitter-image',
];

/**
 * Prefixes that are public but must stay reachable to unauthenticated visitors,
 * so they are exempt from the "send signed-in users to the dashboard" redirect.
 */
const PUBLIC_API_PREFIXES = ['/api/demo'];

/**
 * Path prefixes that are always public.
 */
const PUBLIC_PREFIXES = ['/icons/', '/_next/', '/api/auth/'];

/**
 * Routes that authenticated users should be redirected away from.
 * If a logged-in user visits these, they get sent to the dashboard.
 */
/**
 * Routes a signed-in user has no reason to see. Visiting these while
 * authenticated sends them straight to their dashboard.
 */
const REDIRECT_WHEN_SIGNED_IN = ['/', '/login', '/signup'];

function isPublicRoute(pathname: string): boolean {
  // Check exact matches
  if (PUBLIC_ROUTES.includes(pathname)) {
    return true;
  }

  // Check prefix matches
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }

  if (PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }

  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always refresh the session (keeps tokens alive)
  const { supabaseResponse, user } = await updateSession(request);

  // Public routes: allow access regardless of auth state, but send signed-in
  // users from the marketing page and auth screens to their dashboard.
  if (isPublicRoute(pathname)) {
    if (user && REDIRECT_WHEN_SIGNED_IN.includes(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // Protected routes: redirect unauthenticated users to /login
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - Static asset files (images, fonts, etc.)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)$).*)',
  ],
};
