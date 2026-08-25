const withSerwist = require("@serwist/next").default({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: true,
  reloadOnOnline: true,
  // In development the service worker caches webpack chunks that are rebuilt on
  // every edit, so a stale chunk gets served after a rebuild and crashes the
  // app. The PWA still builds and runs in production.
  disable: process.env.NODE_ENV === "development",
});

/** @type {import('next').NextConfig} */
const nextConfig = {};

module.exports = withSerwist(nextConfig);
