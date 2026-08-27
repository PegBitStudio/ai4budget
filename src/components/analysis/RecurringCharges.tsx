"use client";

import { formatCurrency } from "@/utils/formatters";

export interface RecurringCharge {
  description: string;
  category: string;
  monthsSeen: number;
  monthlyCost: number;
  latestMonthCost: number;
  changePercent: number;
  increased: boolean;
}

export interface RecurringSummary {
  charges: RecurringCharge[];
  totalMonthlyCost: number;
  increaseAmount: number;
  goalImpact?: {
    monthsDelayed: number;
    monthlyRate: number;
    label: string;
  } | null;
}

/** How many charges the list shows before deferring to the headline total. */
const MAX_VISIBLE = 8;

/**
 * Money leaving on autopilot.
 *
 * These are the charges that never appear unusual — they are the same every
 * month, which is exactly why nobody notices them adding up, or creeping.
 */
export default function RecurringCharges({
  summary,
}: {
  summary: RecurringSummary;
}) {
  if (summary.charges.length === 0) {
    return null;
  }

  const creeping = summary.charges.filter((c) => c.increased);
  // The headline total already covers everything; the list only needs to show
  // where the money actually goes.
  const visible = summary.charges.slice(0, MAX_VISIBLE);
  const remaining = summary.charges.length - visible.length;

  return (
    <section className="mt-8" aria-labelledby="recurring-heading">
      <h2
        id="recurring-heading"
        className="text-lg font-semibold tracking-tight text-ink-900"
      >
        Money on autopilot
      </h2>
      <p className="mt-1 text-sm text-ink-600">
        Charges that repeat every month. They never look unusual, which is why
        they are easy to miss.
      </p>

      <div className="surface-deep mt-4 rounded-lg bg-[#27235b] p-5 text-paper shadow-card sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-200">
          Leaving your account every month
        </p>
        <p className="mt-1.5 text-3xl font-semibold tracking-tight tabular-nums">
          {formatCurrency(summary.totalMonthlyCost)}
        </p>
        <p className="mt-2 text-sm leading-6 text-ink-100">
          Across {summary.charges.length} recurring{" "}
          {summary.charges.length === 1 ? "charge" : "charges"}
          {creeping.length > 0 && (
            <>
              {" — "}
              <span className="font-semibold text-negative-100">
                {formatCurrency(summary.increaseAmount)} more than it used to be
              </span>
            </>
          )}
          .
        </p>

        {/* The creep, priced in goal progress. It is small each month, which
            is exactly why it is worth naming. */}
        {summary.goalImpact && (
          <p className="mt-3 border-t border-ink-200/15 pt-3 text-sm leading-6 text-ink-100">
            Left alone for a year, that increase alone sets your savings goal
            back{" "}
            <span className="font-semibold text-paper">
              {summary.goalImpact.label}
            </span>
            .
          </p>
        )}
      </div>

      <ul className="mt-4 divide-y divide-ink-100 rounded-lg border border-ink-200 bg-paper shadow-card">
        {visible.map((charge) => (
          <li
            key={`${charge.description}-${charge.category}`}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 p-4"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink-900">
                {charge.description}
              </p>
              <p className="text-xs text-ink-500">
                {charge.category} · seen in {charge.monthsSeen} months
              </p>
            </div>

            <div className="text-right">
              <p className="text-sm font-semibold tabular-nums text-ink-900">
                {formatCurrency(charge.latestMonthCost)}
                <span className="font-normal text-ink-500">/mo</span>
              </p>
              {charge.increased && (
                <p className="text-xs font-medium text-negative-700">
                  up {Math.round(charge.changePercent)}% from{" "}
                  {formatCurrency(charge.monthlyCost)}
                </p>
              )}
            </div>
          </li>
        ))}
        {remaining > 0 && (
          <li className="p-4 text-sm text-ink-500">
            and {remaining} smaller recurring{" "}
            {remaining === 1 ? "charge" : "charges"}
          </li>
        )}
      </ul>
    </section>
  );
}
