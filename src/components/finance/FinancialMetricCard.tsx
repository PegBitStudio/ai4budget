"use client";

import { formatCurrency } from "@/utils/formatters";
import { useCountUp } from "@/hooks/useCountUp";
import { Card, Delta, Skeleton, cx } from "@/components/ui/primitives";

export interface MetricSpark {
  /** Ordered oldest to newest. Rendered as a hairline trend, not a chart. */
  points: number[];
}

/**
 * A single headline figure with its context.
 *
 * The figure dominates; the label and comparison stay quiet beneath it. That
 * ordering is the whole point — a finance manager should be able to read the
 * number first and the explanation only if they want it.
 */
export default function FinancialMetricCard({
  label,
  value,
  format = "currency",
  delta,
  deltaSuffix = "%",
  invertDelta = false,
  caption,
  spark,
  tone = "neutral",
  loading = false,
}: {
  label: string;
  value: number;
  /** Not every headline figure is an amount — a rate is still the headline. */
  format?: "currency" | "percent";
  /** Percentage change against the previous period. */
  delta?: number | null;
  deltaSuffix?: string;
  invertDelta?: boolean;
  caption?: string;
  spark?: MetricSpark;
  tone?: "neutral" | "positive" | "negative";
  loading?: boolean;
}) {
  const animated = useCountUp(value);

  if (loading) {
    return (
      <Card className="p-5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-7 w-36" />
        <Skeleton className="mt-3 h-3 w-28" />
      </Card>
    );
  }

  const figureTone =
    tone === "positive"
      ? "text-positive-700"
      : tone === "negative"
        ? "text-negative-700"
        : "text-ink-950";

  return (
    <Card className="flex flex-col justify-between p-5">
      <div>
        <p className="text-eyebrow uppercase text-ink-500">{label}</p>
        <p className={cx("mt-2 text-figure tnum", figureTone)}>
          {format === "percent"
            ? `${Math.round(animated)}%`
            : formatCurrency(animated)}
        </p>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-label text-ink-500">
          {delta !== undefined && delta !== null && (
            <Delta
              value={delta}
              suffix={deltaSuffix}
              invert={invertDelta}
              className="mr-1.5 font-medium"
            />
          )}
          {caption}
        </p>
        {spark && spark.points.length > 1 && (
          <Sparkline points={spark.points} tone={tone} />
        )}
      </div>
    </Card>
  );
}

/**
 * A hairline trend, deliberately unlabelled. It shows shape, not values — the
 * figure above it already carries the precision.
 */
function Sparkline({
  points,
  tone,
}: {
  points: number[];
  tone: "neutral" | "positive" | "negative";
}) {
  const width = 72;
  const height = 24;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const path = points
    .map((point, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = height - ((point - min) / range) * height;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const stroke =
    tone === "positive"
      ? "var(--color-positive-600)"
      : tone === "negative"
        ? "var(--color-negative-600)"
        : "var(--color-ink-400)";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      aria-hidden="true"
      className="shrink-0 overflow-visible"
    >
      <path
        d={path}
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={width}
        cy={height - ((points[points.length - 1] - min) / range) * height}
        r="2"
        fill={stroke}
      />
    </svg>
  );
}
