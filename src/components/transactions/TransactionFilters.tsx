"use client";

import { CATEGORIES } from "@/models/category";
import { Button, cx } from "@/components/ui/primitives";

export interface Filters {
  search: string;
  category: string;
  type: "" | "income" | "expense";
  from: string;
  to: string;
}

export const EMPTY_FILTERS: Filters = {
  search: "",
  category: "",
  type: "",
  from: "",
  to: "",
};

/**
 * One row of controls above the ledger.
 *
 * Kept on a single line rather than behind a "Filters" disclosure: the whole
 * point is to see what is currently applied without opening anything. A filter
 * you have forgotten is on is worse than no filter at all.
 */
export default function TransactionFilters({
  value,
  onChange,
  total,
  showing,
}: {
  value: Filters;
  onChange: (next: Filters) => void;
  total: number;
  showing: number;
}) {
  const active =
    value.search || value.category || value.type || value.from || value.to;

  const set = (patch: Partial<Filters>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={value.search}
            onChange={(e) => set({ search: e.target.value })}
            placeholder="Search descriptions…"
            aria-label="Search transactions"
            className={cx(control, "w-full pl-9")}
          />
        </div>

        <select
          value={value.category}
          onChange={(e) => set({ category: e.target.value })}
          aria-label="Filter by category"
          className={cx(control, "bg-paper")}
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {/* Direction, as a segmented control rather than a third dropdown */}
        <div className="flex rounded-md border border-ink-200 bg-paper p-0.5">
          {([
            ["", "All"],
            ["income", "In"],
            ["expense", "Out"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => set({ type: key })}
              aria-pressed={value.type === key}
              className={cx(
                "min-h-8 rounded-sm px-3 text-label font-medium transition-colors duration-[--duration-fast]",
                value.type === key
                  ? "bg-ink-900 text-paper"
                  : "text-ink-600 hover:text-ink-900"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={value.from}
            onChange={(e) => set({ from: e.target.value })}
            aria-label="From date"
            className={cx(control, "w-[9.5rem]")}
          />
          <span className="text-label text-ink-400">to</span>
          <input
            type="date"
            value={value.to}
            onChange={(e) => set({ to: e.target.value })}
            aria-label="To date"
            className={cx(control, "w-[9.5rem]")}
          />
        </div>

        {active && (
          <Button variant="ghost" size="sm" onClick={() => onChange(EMPTY_FILTERS)}>
            Clear
          </Button>
        )}
      </div>

      <p className="text-label text-ink-500 tnum" aria-live="polite">
        {total === 0
          ? "No transactions match"
          : `Showing ${showing} of ${total} transaction${total === 1 ? "" : "s"}`}
      </p>
    </div>
  );
}

const control =
  "min-h-9 rounded-md border border-ink-200 bg-paper px-3 text-label text-ink-900 transition-colors duration-[--duration-fast] focus:border-ink-900 focus:outline-none";
