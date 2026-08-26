"use client";

import Link from "next/link";
import { formatCurrency } from "@/utils/formatters";
import { useCountUp } from "@/hooks/useCountUp";
import { Delta, cx } from "@/components/ui/primitives";

/**
 * The month's headline, on the one genuinely rich surface in the product.
 *
 * Everything else here is a hairline border on white, which is the right
 * default for reading figures — but an interface made entirely of that reads
 * as a spreadsheet. This panel is the exception that gives the page somewhere
 * to look first: a deep surface, lit from two corners, with the number large
 * enough to be the point.
 *
 * The glow drifts slowly. It is the only ambient motion in the app, and it is
 * what stops the dark surface reading as a flat black rectangle.
 */
export default function NetPositionHero({
  net,
  income,
  spending,
  spendingDelta,
  loading,
}: {
  net: number;
  income: number;
  spending: number;
  spendingDelta: number | null;
  loading: boolean;
}) {
  const animated = useCountUp(net, 900);
  const negative = net < 0;
  const spentShare = income > 0 ? Math.min((spending / income) * 100, 100) : 0;

  if (loading) {
    return (
      <div className="h-[212px] w-full animate-pulse rounded-xl bg-ink-200" />
    );
  }

  return (
    <section
      className="relative isolate overflow-hidden rounded-xl bg-ink-950 px-6 py-7 text-paper shadow-raised sm:px-8"
      aria-label="Net position this month"
    >
      {/* Two drifting lights. Without them the panel is a black rectangle. */}
      <div
        aria-hidden="true"
        className="animate-drift pointer-events-none absolute -left-24 -top-32 -z-10 size-96 rounded-full bg-jade-600/25 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="animate-drift pointer-events-none absolute -bottom-40 right-0 -z-10 size-80 rounded-full blur-3xl"
        style={{
          animationDelay: "-9s",
          background: negative
            ? "rgba(180, 35, 24, 0.28)"
            : "rgba(4, 120, 87, 0.24)",
        }}
      />

      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
        <div className="min-w-0">
          <p className="text-eyebrow uppercase text-ink-400">
            Net position this month
          </p>
          <p
            className={cx(
              "mt-2 text-5xl font-semibold tracking-[-0.03em] tnum sm:text-6xl",
              negative ? "text-negative-100" : "text-paper"
            )}
          >
            {formatCurrency(animated)}
          </p>
          <p className="mt-3 max-w-md text-body leading-relaxed text-ink-300">
            {income === 0 && spending === 0
              ? "Add your income and first expenses to see where your money goes."
              : negative
                ? `You have spent ${formatCurrency(Math.abs(net))} more than you earned.`
                : `${formatCurrency(net)} still available after everything logged.`}
          </p>
        </div>

        {/* Income and spending, side by side, with the share of income used. */}
        <div className="w-full max-w-xs shrink-0">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <p className="text-eyebrow uppercase text-ink-400">In</p>
              <p className="mt-1 text-lg font-semibold tnum text-paper">
                {formatCurrency(income)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-eyebrow uppercase text-ink-400">Out</p>
              <p className="mt-1 text-lg font-semibold tnum text-paper">
                {formatCurrency(spending)}
              </p>
              {spendingDelta !== null && (
                <Delta
                  value={spendingDelta}
                  suffix="%"
                  invert
                  className="text-label"
                />
              )}
            </div>
          </div>

          <div
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-paper/15"
            role="progressbar"
            aria-valuenow={Math.round(spentShare)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Share of income spent"
          >
            <div
              className={cx(
                "animate-grow h-full rounded-full",
                negative ? "bg-negative-600" : "bg-jade-500"
              )}
              style={{ width: `${spentShare}%` }}
            />
          </div>
          <p className="mt-2 text-label text-ink-400">
            {spentShare.toFixed(0)}% of income spent
          </p>

          <Link
            href="/analysis"
            className="mt-4 inline-flex min-h-9 items-center gap-1.5 rounded-md bg-paper/10 px-3 text-label font-medium text-paper backdrop-blur transition-colors duration-[--duration-fast] hover:bg-paper/20"
          >
            See what drove it
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
