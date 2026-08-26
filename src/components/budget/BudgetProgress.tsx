"use client";

import { formatCurrency } from "@/utils/formatters";

export interface ComparisonRow {
  category: string;
  budgeted: number;
  actual: number;
  variance: number;
  status: "under" | "on-track" | "over";
}

/**
 * Planned versus actual, as a bar per category rather than a table of numbers.
 *
 * The worst overspend leads, because that is the thing the user can act on.
 * A plain table gave every row the same visual weight, which meant the one
 * category 1,400% over its plan looked exactly like the one 4% under.
 */
export default function BudgetProgress({ rows }: { rows: ComparisonRow[] }) {
  // Worst first: furthest over the line, down to comfortably under.
  const sorted = [...rows].sort((a, b) => share(b) - share(a));

  const totalPlanned = rows.reduce((sum, r) => sum + r.budgeted, 0);
  const totalActual = rows.reduce((sum, r) => sum + r.actual, 0);
  const overCount = rows.filter((r) => r.status === "over").length;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="text-sm text-ink-600">
          {overCount === 0
            ? "Every category is inside its plan."
            : overCount === 1
              ? `1 of ${rows.length} categories is over plan.`
              : `${overCount} of ${rows.length} categories are over plan.`}
        </p>
        <p className="text-sm text-ink-600 tabular-nums">
          <span className="font-semibold text-ink-900">
            {formatCurrency(totalActual)}
          </span>{" "}
          spent of {formatCurrency(totalPlanned)} planned
        </p>
      </div>

      <ul className="space-y-4">
        {sorted.map((row) => (
          <CategoryBar key={row.category} row={row} />
        ))}
      </ul>
    </div>
  );
}

function CategoryBar({ row }: { row: ComparisonRow }) {
  const pct = share(row);
  const isOver = row.status === "over";
  const unplanned = row.budgeted <= 0 && row.actual > 0;

  // Spending with no allocation behind it has no percentage worth showing —
  // "9999% used" is noise. Name the situation instead.
  if (unplanned) {
    return (
      <li>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
          <p className="text-sm font-semibold text-ink-900">{row.category}</p>
          <p className="text-sm font-semibold tabular-nums text-ink-900">
            {formatCurrency(row.actual)}
          </p>
        </div>
        <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-ink-100">
          <div className="h-full w-full bg-ink-400" />
        </div>
        <p className="mt-1 text-xs font-medium text-ink-600">
          Not in your plan
          <span className="text-ink-500">
            {" · "}set an amount to start tracking it
          </span>
        </p>
      </li>
    );
  }

  // Past 100% the bar fills completely and the overspill shows as a darker
  // band, so "how far over" stays readable without the bar leaving the row.
  const filled = Math.min(pct, 100);
  const spill = pct > 100 ? Math.min(((pct - 100) / pct) * 100, 100) : 0;

  const tone = isOver
    ? { bar: "bg-negative-600", spill: "bg-negative-700", text: "text-negative-700" }
    : row.status === "on-track"
      ? { bar: "bg-warning-600", spill: "", text: "text-warning-700" }
      : { bar: "bg-positive-600", spill: "", text: "text-positive-700" };

  return (
    <li>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
        <p className="text-sm font-semibold text-ink-900">{row.category}</p>
        <p className="text-sm tabular-nums text-ink-600">
          <span className="font-semibold text-ink-900">
            {formatCurrency(row.actual)}
          </span>
          <span className="text-ink-400"> / </span>
          {formatCurrency(row.budgeted)}
        </p>
      </div>

      <div className="mt-1.5 flex h-2.5 overflow-hidden rounded-full bg-ink-100">
        <div
          className={`h-full ${tone.bar}`}
          style={{ width: `${filled}%` }}
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${row.category}: ${Math.round(pct)}% of plan used`}
        />
        {spill > 0 && (
          <div
            className={`h-full ${tone.spill}`}
            style={{ width: `${spill}%`, marginLeft: `-${spill}%` }}
          />
        )}
      </div>

      <p className={`mt-1 text-xs font-medium tabular-nums ${tone.text}`}>
        {Math.round(pct)}% used
        <span className="text-ink-500">
          {" · "}
          {isOver
            ? `${formatCurrency(Math.abs(row.variance))} over`
            : `${formatCurrency(Math.abs(row.variance))} left`}
        </span>
      </p>
    </li>
  );
}

/**
 * Percentage of the allocation used. Spending against a category with no
 * allocation is capped rather than infinite, so it sorts to the top and still
 * renders a finite bar width.
 */
const UNBUDGETED_SHARE = 9999;

function share(row: ComparisonRow): number {
  if (row.budgeted <= 0) return row.actual > 0 ? UNBUDGETED_SHARE : 0;
  return (row.actual / row.budgeted) * 100;
}
