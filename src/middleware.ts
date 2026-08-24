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
  '/offline',
  '/manifest.webmanifest',
  '/sw.js',
  '/apple-touch-icon.png',
];

/**
 * Path prefixes that are always public.
 */
const PUBLIC_PREFIXES = ['/icons/', '/_next/', '/api/auth/'];

/**
 * Routes that authenticated users should be redirected away from.
 * If a logged-in user visits these, they get sent to the dashboard.
 */
const AUTH_ROUTES = ['/login', '/signup'];

function isPublicRoute(pathname: string): boolean {
  // Check exact matches
  if (PUBLIC_ROUTES.includes(pathname)) {
    return true;
  }

  // Check prefix matches
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }

  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always refresh the session (keeps tokens alive)
  const { supabaseResponse, user } = await updateSession(request);

  // Public routes: allow access regardless of auth state,
  // but redirect authenticated users away from login/signup
  if (isPublicRoute(pathname)) {
    if (user && AUTH_ROUTES.includes(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
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
