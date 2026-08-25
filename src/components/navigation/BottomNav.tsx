"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isActive } from "./navItems";
import { cx } from "@/components/ui/primitives";

/**
 * Mobile navigation.
 *
 * Deliberately kept rather than shrinking the desktop rail: this is a personal
 * finance app that will mostly be opened one-handed on a phone, and a bottom
 * bar puts every destination inside thumb reach. Settings lives on the account
 * screen instead of here — six targets is already the practical ceiling.
 */
export default function BottomNav() {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => !item.desktopOnly);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-200 bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      aria-label="Main"
    >
      <ul className="mx-auto flex h-16 max-w-lg items-stretch justify-around">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex h-full min-h-11 flex-col items-center justify-center gap-1 px-1",
                  "transition-colors duration-[--duration-fast]",
                  active ? "text-ink-900" : "text-ink-400 hover:text-ink-600"
                )}
              >
                {item.icon}
                <span
                  className={cx(
                    "text-[10px] leading-none",
                    active ? "font-semibold" : "font-medium"
                  )}
                >
                  {item.shortLabel ?? item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
