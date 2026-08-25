"use client";

import { useEffect } from "react";

/**
 * Removes any service worker left over from an earlier deploy.
 *
 * Switching the worker off in next.config stops it being registered again, but
 * a browser that already installed it keeps that copy in charge — still
 * serving whatever it cached, including chunks that no longer exist. This
 * unregisters it and empties its caches on next visit, so a returning visitor
 * lands on the live site rather than a stale one.
 *
 * Safe to leave in place: with no worker registered it does nothing.
 */
export default function ServiceWorkerCleanup() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker
      .getRegistrations()
      .then(async (registrations) => {
        if (registrations.length === 0) {
          return;
        }

        await Promise.all(registrations.map((r) => r.unregister()));

        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((key) => caches.delete(key)));
        }

        // The page was loaded through the old worker, so reload once to fetch
        // it from the network now that the worker is gone.
        window.location.reload();
      })
      .catch(() => {
        // Nothing to clean up, or the browser refused. Either way, carry on.
      });
  }, []);

  return null;
}
