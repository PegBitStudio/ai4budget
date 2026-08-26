"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/utils/formatters";
import { categoryColor } from "@/config/categories";
import { cx } from "@/components/ui/primitives";
import {
  applyThemeChoice,
  readThemeChoice,
  resolvedTheme,
  type ThemeChoice,
} from "@/lib/theme";
import type { Transaction } from "@/models/transaction";

/**
 * ⌘K.
 *
 * Two things in one list: the places you can go and the things you can do, plus
 * your own transactions once you have typed enough to be looking for one. The
 * search is the reason this is worth building — in a product whose whole job is
 * "where did the money go", being able to type a merchant name from anywhere
 * and land on it is the fastest path through the app.
 */

type Item = {
  id: string;
  label: string;
  hint?: string;
  group: "Go to" | "Do" | "Transactions";
  keywords?: string;
  icon: React.ReactNode;
  run: () => void;
};

const MIN_SEARCH = 2;

export default function CommandMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [matches, setMatches] = useState<Transaction[]>([]);
  const [theme, setTheme] = useState<ThemeChoice>("system");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => setTheme(readThemeChoice()), []);

  // Every key the menu cares about is handled here, on the document, rather
  // than on the input: the list stays drivable even if focus drifts onto a row
  // or out of the panel, and there is one place that decides what a key means.
  // A ref carries the current list in, so the listener binds once.
  const stateRef = useRef({ open, filtered: [] as Item[], active });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((wasOpen) => !wasOpen);
        return;
      }

      const current = stateRef.current;
      if (!current.open) return;

      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => (i + 1) % Math.max(1, current.filtered.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const n = Math.max(1, current.filtered.length);
        setActive((i) => (i - 1 + n) % n);
      } else if (e.key === "Enter") {
        e.preventDefault();
        current.filtered[current.active]?.run();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Reset on every open, so it never reopens holding the last search.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    setMatches([]);
    // Focused directly rather than through requestAnimationFrame: the DOM is
    // already committed by the time this effect runs, and rAF does not fire in
    // a tab that is not painting — which would open the menu with no caret.
    inputRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Look up transactions once the query is worth a round trip.
  useEffect(() => {
    const term = query.trim();
    if (term.length < MIN_SEARCH) {
      setMatches([]);
      return;
    }

    let cancelled = false;
    const id = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/transactions?search=${encodeURIComponent(term)}&limit=5`
        );
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setMatches(data.transactions ?? []);
      } catch {
        // A failed lookup just means no transaction rows this keystroke.
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [query]);

  const go = useCallback(
    (href: string) => () => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  const cycleTheme = useCallback(() => {
    const next: ThemeChoice =
      theme === "system" ? (resolvedTheme() === "dark" ? "light" : "dark")
      : theme === "dark" ? "light"
      : "dark";
    applyThemeChoice(next);
    setTheme(next);
    setOpen(false);
  }, [theme]);

  const items: Item[] = useMemo(() => {
    const nav: Item[] = [
      ["/dashboard", "Overview", "Where the month stands", "home summary"],
      ["/transactions", "Transactions", "Every row, searchable", "ledger list spending"],
      ["/budget", "Budget", "Plan against actual", "plan allocation"],
      ["/analysis", "Insights", "What changed and why", "analysis trends anomalies"],
      ["/savings", "Goals", "What you are saving towards", "savings target"],
      ["/qa", "Assistant", "Ask about your money", "chat ai question"],
      ["/reports", "Reports", "A month, written out", "report print pdf export statement"],
      ["/settings", "Settings", "Account and data", "preferences account"],
    ].map(([href, label, hint, keywords]) => ({
      id: `nav:${href}`,
      label,
      hint,
      keywords,
      group: "Go to" as const,
      icon: <ArrowIcon />,
      run: go(href),
    }));

    const actions: Item[] = [
      {
        id: "do:add",
        label: "Add a transaction",
        hint: "Record one by hand",
        keywords: "new create expense income",
        group: "Do",
        icon: <PlusIcon />,
        run: go("/transactions"),
      },
      {
        id: "do:import",
        label: "Import bank alerts or a CSV",
        hint: "Paste alerts, drop a file",
        keywords: "upload paste sms statement",
        group: "Do",
        icon: <ImportIcon />,
        run: go("/transactions"),
      },
      {
        id: "do:export",
        label: "Export everything as CSV",
        hint: "Download your data",
        keywords: "download backup",
        group: "Do",
        icon: <DownloadIcon />,
        run: () => {
          setOpen(false);
          window.location.href = "/api/csv/export";
        },
      },
      {
        id: "do:theme",
        label: resolvedTheme() === "dark" ? "Switch to light" : "Switch to dark",
        hint: theme === "system" ? "Currently following your system" : undefined,
        keywords: "theme dark light appearance mode",
        group: "Do",
        icon: <ThemeIcon />,
        run: cycleTheme,
      },
    ];

    const found: Item[] = matches.map((t) => ({
      id: `tx:${t.id}`,
      label: t.description,
      // The date is what separates five identical Bolt rides from each other.
      hint: `${shortDate(t.date)} · ${t.type === "income" ? "Income" : t.category} · ${formatCurrency(t.amount)}`,
      group: "Transactions",
      icon: (
        <span
          aria-hidden="true"
          className="size-2 rounded-full"
          style={{
            backgroundColor:
              t.type === "income"
                ? "var(--color-positive-600)"
                : categoryColor(t.category),
          }}
        />
      ),
      // Carry the search across, so picking a row lands on that row rather than
      // on an unfiltered list you have to search all over again.
      run: go(`/transactions?search=${encodeURIComponent(t.description)}`),
    }));

    return [...nav, ...actions, ...found];
  }, [go, matches, theme, cycleTheme]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return items;

    return items.filter((item) => {
      // Transaction rows came back from a server-side search on this term —
      // filtering them again locally would only throw away real matches.
      if (item.group === "Transactions") return true;
      return `${item.label} ${item.hint ?? ""} ${item.keywords ?? ""}`
        .toLowerCase()
        .includes(term);
    });
  }, [items, query]);

  // Keep the highlight inside the list as it shrinks under you.
  useEffect(() => {
    setActive((current) => Math.min(current, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  // Hand the current list to the document listener, which binds only once.
  stateRef.current = { open, filtered, active };

  useEffect(() => {
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  let lastGroup: string | null = null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command menu"
    >
      <div
        className="animate-fade absolute inset-0 bg-[rgba(6,8,9,0.55)] backdrop-blur-[3px]"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      <div className="animate-rise relative w-full max-w-xl overflow-hidden rounded-xl border border-ink-200 bg-paper shadow-overlay">
        <div className="flex items-center gap-3 border-b border-ink-100 px-4">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true" className="size-4 shrink-0 text-ink-400">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            placeholder="Search pages, actions, or a merchant…"
            aria-label="Search pages, actions, or a merchant"
            className="min-h-14 flex-1 bg-transparent text-body text-ink-900 placeholder:text-ink-400 focus:outline-none"
          />
          <kbd className="hidden shrink-0 rounded-xs border border-ink-200 px-1.5 py-0.5 text-eyebrow text-ink-500 sm:block">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-8 text-center text-body text-ink-500">
              Nothing matches “{query}”.
            </p>
          ) : (
            filtered.map((item, i) => {
              const newGroup = item.group !== lastGroup;
              lastGroup = item.group;

              return (
                <div key={item.id}>
                  {newGroup && (
                    <p className="px-3 pb-1 pt-3 text-eyebrow uppercase text-ink-500 first:pt-1">
                      {item.group}
                    </p>
                  )}
                  <button
                    data-active={i === active}
                    onMouseMove={() => setActive(i)}
                    onClick={item.run}
                    className={cx(
                      "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors duration-[--duration-fast]",
                      i === active ? "bg-ink-100" : "hover:bg-ink-50"
                    )}
                  >
                    <span className="grid size-5 shrink-0 place-items-center text-ink-500">
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-body text-ink-900">
                      {item.label}
                    </span>
                    {item.hint && (
                      <span className="shrink-0 truncate text-label text-ink-500">
                        {item.hint}
                      </span>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-ink-100 px-4 py-2.5 text-label text-ink-500">
          <span className="flex items-center gap-1.5">
            <Key>↑</Key>
            <Key>↓</Key>
            to move
          </span>
          <span className="flex items-center gap-1.5">
            <Key>↵</Key>
            to open
          </span>
          {query.trim().length >= MIN_SEARCH && (
            <span className="ml-auto hidden sm:block">
              Searching your transactions
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function shortDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="grid min-h-5 min-w-5 place-items-center rounded-xs border border-ink-200 px-1 text-eyebrow text-ink-600">
      {children}
    </kbd>
  );
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function ArrowIcon() {
  return (
    <svg viewBox="0 0 16 16" {...stroke} aria-hidden="true" className="size-4">
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" {...stroke} aria-hidden="true" className="size-4">
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

function ImportIcon() {
  return (
    <svg viewBox="0 0 16 16" {...stroke} aria-hidden="true" className="size-4">
      <path d="M8 11V2M5 8l3 3 3-3M3 13h10" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 16 16" {...stroke} aria-hidden="true" className="size-4">
      <path d="M8 2v9M5 8l3 3 3-3M2.5 14h11" />
    </svg>
  );
}

function ThemeIcon() {
  return (
    <svg viewBox="0 0 16 16" {...stroke} aria-hidden="true" className="size-4">
      <circle cx="8" cy="8" r="3.25" />
      <path d="M8 1v1.5M8 13.5V15M15 8h-1.5M2.5 8H1M12.95 3.05l-1.06 1.06M4.11 11.89l-1.06 1.06M12.95 12.95l-1.06-1.06M4.11 4.11L3.05 3.05" />
    </svg>
  );
}
