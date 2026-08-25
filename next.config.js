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

/** @type {import('next').NextConfig} */
const nextConfig = {};

module.exports = withSerwist(nextConfig);
