"use client";

import { formatCurrency } from "@/utils/formatters";
import { CATEGORIES, Category } from "@/models/category";

export interface ReviewRow {
  key: string;
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: Category;
  duplicate: boolean;
  include: boolean;
}

/**
 * The confirm step shared by both importers. Every imported row passes through
 * here before anything is written, so a misread amount or category is caught
 * before it reaches the user's records rather than after.
 */
export default function ImportReviewTable({
  rows,
  onChange,
}: {
  rows: ReviewRow[];
  onChange: (key: string, patch: Partial<ReviewRow>) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[38rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-ink-200 text-left">
            <th scope="col" className="w-10 py-2">
              <span className="sr-only">Include</span>
            </th>
            <th scope="col" className="py-2 pr-3 font-medium text-ink-500">
              Date
            </th>
            <th scope="col" className="py-2 pr-3 font-medium text-ink-500">
              Description
            </th>
            <th scope="col" className="py-2 pr-3 font-medium text-ink-500">
              Category
            </th>
            <th scope="col" className="py-2 text-right font-medium text-ink-500">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.key}
              className={`border-b border-ink-100 ${
                row.include ? "" : "opacity-50"
              }`}
            >
              <td className="py-2">
                <input
                  type="checkbox"
                  checked={row.include}
                  onChange={(e) =>
                    onChange(row.key, { include: e.target.checked })
                  }
                  aria-label={`Include ${row.description}`}
                  className="h-4 w-4 rounded border-ink-300 text-ink-900 focus:ring-ink-700"
                />
              </td>
              <td className="py-2 pr-3 whitespace-nowrap text-ink-600 tabular-nums">
                {formatShortDate(row.date)}
              </td>
              <td className="py-2 pr-3 text-ink-900">
                <span className="block max-w-[16rem] truncate">
                  {row.description}
                </span>
                {row.duplicate && (
                  <span className="mt-0.5 inline-block rounded bg-warning-100 px-1.5 py-0.5 text-[11px] font-medium text-warning-700">
                    Already imported
                  </span>
                )}
              </td>
              <td className="py-2 pr-3">
                {row.type === "income" ? (
                  <span className="text-positive-700">Income</span>
                ) : (
                  <select
                    value={row.category}
                    onChange={(e) =>
                      onChange(row.key, {
                        category: e.target.value as Category,
                      })
                    }
                    aria-label={`Category for ${row.description}`}
                    className="rounded-lg border border-ink-300 px-2 py-1 text-sm focus:border-ink-700 focus:outline-none focus:ring-1 focus:ring-ink-700"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                )}
              </td>
              <td
                className={`py-2 text-right font-medium tabular-nums ${
                  row.type === "income" ? "text-positive-700" : "text-ink-900"
                }`}
              >
                {row.type === "income" ? "+" : "−"}
                {formatCurrency(row.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function formatShortDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}
