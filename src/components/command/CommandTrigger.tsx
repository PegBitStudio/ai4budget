"use client";

import { useEffect, useState } from "react";
import { cx } from "@/components/ui/primitives";

/**
 * The visible way in to ⌘K.
 *
 * A shortcut nobody can see is a shortcut nobody uses, so the sidebar carries a
 * search field that does nothing but announce the key. It dispatches the same
 * keystroke the menu already listens for, rather than holding open state of its
 * own — one owner for whether the menu is open.
 */
export default function CommandTrigger({ collapsed }: { collapsed: boolean }) {
  const [mac, setMac] = useState(false);

  useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.platform ?? ""));
  }, []);

  function open() {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
    );
  }

  return (
    <button
      type="button"
      onClick={open}
      title="Search — ⌘K"
      aria-label="Search pages, actions and transactions"
      aria-keyshortcuts="Meta+K Control+K"
      className={cx(
        "flex w-full items-center gap-3 rounded-md border border-ink-200 px-2.5 py-2 text-label",
        "text-ink-500 transition-colors duration-[--duration-fast] hover:border-ink-300 hover:bg-ink-50 hover:text-ink-800",
        collapsed && "justify-center px-0"
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true" className="size-4 shrink-0">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
      </svg>
      {!collapsed && (
        <>
          <span className="flex-1 text-left">Search</span>
          <kbd className="rounded-xs border border-ink-200 px-1.5 py-0.5 text-eyebrow text-ink-500">
            {mac ? "⌘" : "Ctrl"}K
          </kbd>
        </>
      )}
    </button>
  );
}
