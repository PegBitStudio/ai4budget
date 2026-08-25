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
        className="text-lg font-semibold tracking-tight text-slate-900"
      >
        Money on autopilot
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Charges that repeat every month. They never look unusual, which is why
        they are easy to miss.
      </p>

      <div className="mt-4 rounded-[1.5rem] bg-[#27235b] p-5 text-white shadow-sm sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-200">
          Leaving your account every month
        </p>
        <p className="mt-1.5 text-3xl font-semibold tracking-tight tabular-nums">
          {formatCurrency(summary.totalMonthlyCost)}
        </p>
        <p className="mt-2 text-sm leading-6 text-violet-100">
          Across {summary.charges.length} recurring{" "}
          {summary.charges.length === 1 ? "charge" : "charges"}
          {creeping.length > 0 && (
            <>
              {" — "}
              <span className="font-semibold text-rose-200">
                {formatCurrency(summary.increaseAmount)} more than it used to be
              </span>
            </>
          )}
          .
        </p>
      </div>

      <ul className="mt-4 divide-y divide-slate-100 rounded-[1.5rem] border border-white bg-white shadow-sm">
        {visible.map((charge) => (
          <li
            key={`${charge.description}-${charge.category}`}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 p-4"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">
                {charge.description}
              </p>
              <p className="text-xs text-slate-500">
                {charge.category} · seen in {charge.monthsSeen} months
              </p>
            </div>

            <div className="text-right">
              <p className="text-sm font-semibold tabular-nums text-slate-900">
                {formatCurrency(charge.latestMonthCost)}
                <span className="font-normal text-slate-500">/mo</span>
              </p>
              {charge.increased && (
                <p className="text-xs font-medium text-rose-700">
                  up {Math.round(charge.changePercent)}% from{" "}
                  {formatCurrency(charge.monthlyCost)}
                </p>
              )}
            </div>
          </li>
        ))}
        {remaining > 0 && (
          <li className="p-4 text-sm text-slate-500">
            and {remaining} smaller recurring{" "}
            {remaining === 1 ? "charge" : "charges"}
          </li>
        )}
      </ul>
    </section>
  );
}
