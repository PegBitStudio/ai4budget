"use client";

import { formatCurrency } from "@/utils/formatters";
import { categoryColor } from "@/config/categories";
import { Badge, Skeleton, cx } from "@/components/ui/primitives";
import type { Transaction } from "@/models/transaction";

export type SortKey = "date" | "amount" | "description" | "category";

/**
 * The ledger.
 *
 * A table on desktop because that is what rows of dated, categorised amounts
 * are, and because sorting and scanning a column only work when the values line
 * up. Below `md` it becomes a list — a six-column table on a phone is a
 * horizontal scroll nobody uses.
 *
 * The header row sticks, so the columns stay named however far down you get.
 */
export default function TransactionTable({
  rows,
  loading,
  sort,
  dir,
  onSort,
  onSelect,
  selectedId,
}: {
  rows: Transaction[];
  loading: boolean;
  sort: SortKey;
  dir: "asc" | "desc";
  onSort: (key: SortKey) => void;
  onSelect: (transaction: Transaction) => void;
  selectedId?: string | null;
}) {
  if (loading) {
    return (
      <div className="space-y-px">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Desktop: a real table */}
      <table className="hidden w-full border-collapse md:table">
        <thead className="sticky top-0 z-10 bg-paper">
          <tr className="border-b border-ink-200">
            <SortableHeader label="Date" col="date" {...{ sort, dir, onSort }} className="w-28" />
            <SortableHeader label="Description" col="description" {...{ sort, dir, onSort }} />
            <SortableHeader label="Category" col="category" {...{ sort, dir, onSort }} className="w-44" />
            <SortableHeader label="Amount" col="amount" {...{ sort, dir, onSort }} align="right" className="w-40" />
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const income = t.type === "income";
            return (
              <tr
                key={t.id}
                onClick={() => onSelect(t)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(t);
                  }
                }}
                aria-label={`${t.description}, ${formatCurrency(t.amount)}`}
                className={cx(
                  "cursor-pointer border-b border-ink-100 transition-colors duration-[--duration-fast]",
                  selectedId === t.id ? "bg-ink-100" : "hover:bg-ink-50"
                )}
              >
                <td className="py-3 pr-3 text-label tnum text-ink-500">
                  {formatDate(t.date)}
                </td>
                <td className="py-3 pr-3">
                  <span className="block max-w-[22rem] truncate text-body text-ink-900">
                    {t.description}
                  </span>
                </td>
                <td className="py-3 pr-3">
                  <span className="inline-flex items-center gap-2 text-label text-ink-600">
                    <span
                      aria-hidden="true"
                      className="size-2 shrink-0 rounded-full"
                      style={{
                        backgroundColor: income
                          ? "var(--color-positive-600)"
                          : categoryColor(t.category),
                      }}
                    />
                    {/* Money in is not one of the spending categories, so the
                        classifier's default would read here as a mistake. */}
                    {income ? "Income" : t.category}
                    {!income && !t.is_manual_category && (
                      <Badge tone="ai">AI</Badge>
                    )}
                  </span>
                </td>
                <td
                  className={cx(
                    "py-3 text-right text-body font-medium tnum",
                    income ? "text-positive-600" : "text-ink-900"
                  )}
                >
                  {income ? "+" : "−"}
                  {formatCurrency(t.amount)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Mobile: the same rows, stacked */}
      <ul className="divide-y divide-ink-100 md:hidden">
        {rows.map((t) => {
          const income = t.type === "income";
          return (
            <li key={t.id}>
              <button
                onClick={() => onSelect(t)}
                className="flex w-full items-center gap-3 py-3 text-left transition-colors duration-[--duration-fast] hover:bg-ink-50"
              >
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor: income
                      ? "var(--color-positive-600)"
                      : categoryColor(t.category),
                  }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body text-ink-900">
                    {t.description}
                  </span>
                  <span className="text-label text-ink-500">
                    {income ? "Income" : t.category} · {formatDate(t.date)}
                  </span>
                </span>
                <span
                  className={cx(
                    "shrink-0 text-body font-medium tnum",
                    income ? "text-positive-600" : "text-ink-900"
                  )}
                >
                  {income ? "+" : "−"}
                  {formatCurrency(t.amount)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function SortableHeader({
  label,
  col,
  sort,
  dir,
  onSort,
  align = "left",
  className,
}: {
  label: string;
  col: SortKey;
  sort: SortKey;
  dir: "asc" | "desc";
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
  className?: string;
}) {
  const active = sort === col;

  return (
    <th
      scope="col"
      className={cx("py-2", align === "right" ? "text-right" : "text-left", className)}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        onClick={() => onSort(col)}
        className={cx(
          "inline-flex items-center gap-1 text-eyebrow uppercase transition-colors duration-[--duration-fast]",
          active ? "text-ink-900" : "text-ink-500 hover:text-ink-800"
        )}
      >
        {label}
        <span
          aria-hidden="true"
          className={cx("text-[9px]", active ? "opacity-100" : "opacity-0")}
        >
          {dir === "asc" ? "▲" : "▼"}
        </span>
      </button>
    </th>
  );
}

function formatDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}
