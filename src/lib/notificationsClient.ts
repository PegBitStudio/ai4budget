import type { Notification } from './notifications';
import type { CategoryForecast } from './forecastEngine';

/** A forecast with the sentence already written for it, server-side. */
export type ForecastWithSentence = CategoryForecast & { sentence: string };

export interface NotificationsPayload {
  notifications: Notification[];
  daysRemaining: number | null;
  forecasts: ForecastWithSentence[];
}

/**
 * One request, however many things ask for it.
 *
 * The bell is mounted twice — once in the desktop rail, once in the mobile
 * title bar — and the budget page asks for the same feed again. Left alone
 * that is three identical round trips per page, each running the same handful
 * of queries and the same engines on the server.
 *
 * So callers share one in-flight promise, and its result for a short while
 * after. The window is deliberately small: this is a feed about money moving,
 * and a stale warning is worse than a slow one.
 */

const TTL_MS = 30_000;

let cached: { at: number; payload: NotificationsPayload } | null = null;
let inFlight: Promise<NotificationsPayload> | null = null;

export function fetchNotifications(): Promise<NotificationsPayload> {
  const now = Date.now();

  if (cached && now - cached.at < TTL_MS) {
    return Promise.resolve(cached.payload);
  }
  if (inFlight) {
    return inFlight;
  }

  inFlight = (async () => {
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) {
        // Not cached: a failure should be retried by the next caller, not
        // remembered for thirty seconds.
        return { notifications: [], daysRemaining: null, forecasts: [] };
      }

      const data = await res.json();
      const payload: NotificationsPayload = {
        notifications: data.notifications ?? [],
        daysRemaining: data.daysRemaining ?? null,
        forecasts: data.forecasts ?? [],
      };
      cached = { at: Date.now(), payload };
      return payload;
    } catch {
      return { notifications: [], daysRemaining: null, forecasts: [] };
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/** Drops the cache, so the next read goes back to the server. */
export function invalidateNotifications(): void {
  cached = null;
}
