"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PAGE_META } from "./navItems";
import NotificationBell from "@/components/notifications/NotificationBell";

/**
 * The mobile title bar.
 *
 * On desktop the sidebar already says where you are, so this is hidden there
 * and each page renders its own contextual header instead.
 */
export default function TopHeader() {
  const pathname = usePathname();
  const meta = PAGE_META[pathname];

  return (
    <header className="sticky top-0 z-30 border-b border-ink-200 bg-paper/95 backdrop-blur lg:hidden">
      <div className="flex h-14 items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link
            href="/dashboard"
            aria-label="KoboPilot — go to overview"
            className="grid size-8 shrink-0 place-items-center rounded-md bg-ink-900 text-body font-semibold text-paper"
          >
            K
          </Link>
          <h1 className="truncate text-title text-ink-900">
            {meta?.title ?? "KoboPilot"}
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-1">
        <NotificationBell />
        <Link
          href="/settings"
          aria-label="Settings"
          className="grid size-10 shrink-0 place-items-center rounded-md text-ink-500 transition-colors duration-[--duration-fast] hover:bg-ink-100 hover:text-ink-900"
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
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.6 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 11.5 4a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9 2 2 0 1 1 0 4 1.7 1.7 0 0 0-1.5 1.1z" />
          </svg>
        </Link>
        </div>
      </div>
    </header>
  );
}
