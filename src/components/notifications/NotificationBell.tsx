"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cx } from "@/components/ui/primitives";
import { countUnread, type Notification } from "@/lib/notifications";
import { fetchNotifications } from "@/lib/notificationsClient";

const READ_KEY = "kobopilot:read-notifications";

/** Never closer than this to any edge of the viewport. */
const EDGE_MARGIN = 16;
/** The panel's width when there is room for it — 22rem, same as before. */
const PREFERRED_WIDTH = 352;

interface PanelPosition {
  top: number;
  left: number;
  width: number;
}

/**
 * Where the panel lands, computed from the trigger's actual position rather
 * than a fixed CSS side.
 *
 * This button appears in two places that put it near opposite edges of the
 * screen: the far left in the desktop sidebar, the far right in the mobile
 * title bar. Anchoring purely in CSS ("right: 0, grow left" or the reverse)
 * only stays on-screen if the button happens to have panel-width's worth of
 * room on the side it grows toward — true on neither edge, so the panel used
 * to run off the side of the screen in both. Measuring the trigger and
 * clamping the result to the viewport is what actually guarantees the panel
 * is fully visible everywhere the button might be, including layouts this
 * component does not know about yet.
 */
function computePanelPosition(trigger: HTMLElement): PanelPosition {
  const rect = trigger.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const width = Math.min(PREFERRED_WIDTH, vw - EDGE_MARGIN * 2);

  // Prefer the panel's right edge flush with the button's, the same lean as
  // before — then pull it back onto the screen if that runs past either edge.
  const left = Math.max(
    EDGE_MARGIN,
    Math.min(rect.right - width, vw - width - EDGE_MARGIN)
  );
  const top = Math.min(rect.bottom + 8, vh - EDGE_MARGIN);

  return { top, left, width };
}

/**
 * What the product noticed, without being asked.
 *
 * The signals already existed — they were just scattered across three screens,
 * which meant you only ever saw the one you happened to navigate to. This puts
 * them in the frame, with a count, so the app can tell you a category is about
 * to go over while you are somewhere else entirely.
 *
 * Read state lives in this browser rather than the database. That is a
 * deliberate trade for now: dismissing a warning is a per-device convenience,
 * not a fact about your money, and it keeps the feature off the critical path
 * of a schema migration. Ids are derived from the subject, so a dismissal
 * survives a refresh and next month's version of the same overspend returns.
 */
export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(READ_KEY);
      if (stored) setReadIds(JSON.parse(stored));
    } catch {
      // A blocked or corrupt store just means nothing is marked read.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchNotifications()
      .then((payload) => {
        if (!cancelled) setNotifications(payload.notifications);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Escape closes, so does a click outside, and the position is measured
  // fresh on every open — and kept current across a resize or an orientation
  // change, since the button's on-screen position can move under the panel
  // while it is open.
  useEffect(() => {
    if (!open) return;

    function measure() {
      if (triggerRef.current) {
        setPanelPosition(computePanelPosition(triggerRef.current));
      }
    }

    measure();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onClick(e: MouseEvent) {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    }

    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", measure);
    // Deferred a tick, or the click that opened the panel closes it again.
    const id = setTimeout(() => document.addEventListener("click", onClick), 0);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
      window.removeEventListener("resize", measure);
      clearTimeout(id);
    };
  }, [open]);

  const persist = useCallback((ids: string[]) => {
    setReadIds(ids);
    try {
      window.localStorage.setItem(READ_KEY, JSON.stringify(ids));
    } catch {
      // Storage being unavailable should not stop the panel working.
    }
  }, []);

  const unread = countUnread(notifications, readIds);

  function markAllRead() {
    persist(Array.from(new Set(readIds.concat(notifications.map((n) => n.id)))));
  }

  if (!loaded && notifications.length === 0) {
    return <div className="size-9" aria-hidden="true" />;
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={
          unread > 0
            ? `Notifications, ${unread} unread`
            : "Notifications, none unread"
        }
        className={cx(
          "relative grid size-9 place-items-center rounded-md transition-colors duration-[--duration-fast]",
          open
            ? "bg-ink-100 text-ink-900"
            : "text-ink-500 hover:bg-ink-100 hover:text-ink-900"
        )}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="size-5"
        >
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>

        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-negative-600 px-1 text-[10px] font-semibold leading-4 text-paper"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && panelPosition && (
        <div
          style={{
            position: "fixed",
            top: panelPosition.top,
            left: panelPosition.left,
            width: panelPosition.width,
          }}
          className="animate-rise z-50 overflow-hidden rounded-lg border border-ink-200 bg-paper shadow-overlay"
        >
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <p className="text-label font-medium text-ink-900">
              What KoboPilot noticed
            </p>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="rounded-xs text-label text-ink-500 underline-offset-2 hover:text-ink-900 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-body text-ink-500">
                Nothing needs your attention. Every category is inside its plan.
              </p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {notifications.map((n) => {
                  const isRead = readIds.includes(n.id);
                  return (
                    <li key={n.id}>
                      <Link
                        href={n.href}
                        onClick={() => {
                          persist(Array.from(new Set(readIds.concat(n.id))));
                          setOpen(false);
                        }}
                        className={cx(
                          "flex gap-3 px-4 py-3 transition-colors duration-[--duration-fast] hover:bg-ink-50",
                          isRead && "opacity-55"
                        )}
                      >
                        {/* Severity reads as a colour and as a shape, never as
                            colour alone. */}
                        <span
                          aria-hidden="true"
                          className={cx(
                            "mt-1.5 size-2 shrink-0 rounded-full",
                            n.severity === "critical"
                              ? "bg-negative-600"
                              : n.severity === "warning"
                                ? "bg-warning-600"
                                : "bg-ink-400"
                          )}
                        />
                        <span className="min-w-0">
                          <span className="block text-body font-medium text-ink-900">
                            {n.title}
                          </span>
                          <span className="mt-0.5 block text-label leading-relaxed text-ink-600">
                            {n.body}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
