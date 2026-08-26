// The service worker is switched off for now.
//
// Two reasons, both seen rather than theorised. The generated sw.js references
// a swe-worker-<hash>.js that lives in public/ and is gitignored as a build
// artifact, so it was never deployed — in production that request returned the
// HTML app shell and the browser threw "Unexpected token '<'" on every load.
//
// The larger reason is caching. During development this worker repeatedly
// served a stale webpack chunk after a rebuild and left the app dead on screen.
// The same failure in production, after a redeploy, would hand a returning
// visitor a broken page — an unacceptable risk while the app is being judged.
//
// Offline support is not required by the brief. To bring the PWA back, commit
// the swe-worker file (or stop ignoring it) and re-enable this deliberately,
// with a hard-reload test after a redeploy.
const SERVICE_WORKER_ENABLED = false;

const withSerwist = require("@serwist/next").default({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: true,
  reloadOnOnline: true,
  disable: !SERVICE_WORKER_ENABLED,
});

/**
 * Security headers, applied to every response.
 *
 * A CSP is deliberately not included here. The app uses inline `style=`
 * attributes throughout (category-colour dots, chart theming) and one inline
 * boot script (src/lib/theme.ts) that sets the colour theme before first
 * paint — both need `'unsafe-inline'` or a nonce to survive a real CSP, and
 * getting that wrong fails silently: a swallowed style or script produces
 * missing colours or a flash of the wrong theme, not an error a rushed check
 * before a demo would necessarily catch. The headers below are the ones with
 * no such interaction — they only remove things the app never does anyway.
 */
const securityHeaders = [
  // No page here is meant to be framed by another site — this is what stops a
  // clickjacking overlay tricking someone into an action on their own account.
  { key: "X-Frame-Options", value: "DENY" },
  // Stops a browser from guessing a response's type from its content and
  // running it as something other than what the server declared.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Sends the full URL only to this site's own pages, and the origin only
  // when a link leaves it — a financial app's URLs are not something to hand
  // whichever third party the reader clicks through to next.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Explicitly refuses browser APIs the app has no use for, in case a future
  // dependency's iframe or script would otherwise be free to request them.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

module.exports = withSerwist(nextConfig);
