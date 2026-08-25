"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { NAV_ITEMS, isActive } from "./navItems";
import { cx } from "@/components/ui/primitives";

const COLLAPSE_KEY = "kobopilot:sidebar-collapsed";

/**
 * The desktop application shell.
 *
 * A persistent left rail is most of what separates an application from a
 * website — it keeps the whole product visible at once instead of hiding it
 * behind a menu. Hidden below `lg`, where the bottom bar takes over.
 */
export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  // Restore the user's choice before first paint of the rail.
  useEffect(() => {
    setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  function toggle() {
    setCollapsed((previous) => {
      const next = !previous;
      window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <aside
      className={cx(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-ink-200 bg-paper lg:flex",
        "transition-[width] duration-[--duration-base] ease-[--ease-out-quart]",
        collapsed ? "w-[68px]" : "w-[232px]"
      )}
    >
      {/* Brand */}
      <div className="flex h-16 items-center gap-2.5 px-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 overflow-hidden"
          aria-label="KoboPilot — go to overview"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-ink-900 text-body font-semibold text-paper">
            K
          </span>
          {!collapsed && (
            <span className="truncate text-title text-ink-900">KoboPilot</span>
          )}
        </Link>
      </div>

      {/* Primary navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2" aria-label="Main">
        <ul className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                  className={cx(
                    "group relative flex items-center gap-3 rounded-md px-2.5 py-2",
                    "text-body transition-colors duration-[--duration-fast]",
                    active
                      ? "bg-ink-100 font-medium text-ink-900"
                      : "text-ink-600 hover:bg-ink-50 hover:text-ink-900"
                  )}
                >
                  {/* Active marker reads without relying on the fill alone. */}
                  <span
                    aria-hidden="true"
                    className={cx(
                      "absolute left-0 h-4 w-0.5 rounded-full bg-ink-900 transition-opacity duration-[--duration-fast]",
                      active ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {item.icon}
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Account + collapse */}
      <div className="border-t border-ink-100 p-3">
        {!collapsed && email && (
          <p className="truncate px-2.5 pb-2 text-label text-ink-500" title={email}>
            {email}
          </p>
        )}
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cx(
            "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-label",
            "text-ink-500 transition-colors duration-[--duration-fast] hover:bg-ink-50 hover:text-ink-900"
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
            className={cx(
              "size-5 shrink-0 transition-transform duration-[--duration-base]",
              collapsed && "rotate-180"
            )}
          >
            <path d="M15 6l-6 6 6 6" />
          </svg>
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
