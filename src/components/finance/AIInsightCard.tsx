"use client";

import Link from "next/link";
import { Card, Badge, cx } from "@/components/ui/primitives";

export type InsightKind = "alert" | "opportunity" | "forecast" | "achievement";

export interface Insight {
  kind: InsightKind;
  /** The finding, stated in one line. */
  headline: string;
  /** Why it is true, in the user's own figures. */
  detail: string;
  /** What it costs or saves, already formatted. */
  impact?: string;
  action?: { label: string; href: string };
}

const KIND_META: Record<
  InsightKind,
  { label: string; tone: "negative" | "positive" | "warning" | "ai"; rule: string }
> = {
  alert: { label: "Spending alert", tone: "negative", rule: "bg-negative-600" },
  opportunity: { label: "Opportunity", tone: "positive", rule: "bg-positive-600" },
  forecast: { label: "Forecast", tone: "warning", rule: "bg-warning-600" },
  achievement: { label: "Achievement", tone: "positive", rule: "bg-positive-600" },
};

/**
 * One finding from the assistant, in the shape an analyst would deliver it:
 * what happened, why, what it costs, and what to do about it.
 *
 * The brief's complaint about existing tools is that they "present figures
 * without explaining what actions should be taken" — so an insight without an
 * impact or an action is a half-finished thought, and the layout makes that
 * absence visible rather than hiding it.
 */
export default function AIInsightCard({ insight }: { insight: Insight }) {
  const meta = KIND_META[insight.kind];

  return (
    <Card className="lift group relative overflow-hidden p-5">
      {/* A severity rule rather than a coloured card — the surface stays calm. */}
      <span
        aria-hidden="true"
        className={cx("absolute inset-y-0 left-0 w-0.5", meta.rule)}
      />

      <Badge tone={meta.tone}>{meta.label}</Badge>

      <p className="mt-3 text-title text-ink-900">{insight.headline}</p>
      <p className="mt-1.5 text-body text-ink-600">{insight.detail}</p>

      {insight.impact && (
        <p className="mt-3 border-t border-ink-100 pt-3 text-body font-medium text-ink-900 tnum">
          {insight.impact}
        </p>
      )}

      {insight.action && (
        <Link
          href={insight.action.href}
          className="mt-4 inline-flex items-center gap-1.5 text-body font-medium text-ink-900 underline-offset-4 hover:underline"
        >
          {insight.action.label}
          <span
            aria-hidden="true"
            className="transition-transform duration-[--duration-fast] group-hover:translate-x-0.5"
          >
            →
          </span>
        </Link>
      )}
    </Card>
  );
}

/**
 * The assistant's running commentary on the month.
 *
 * Framed as an analyst's read rather than a chat bubble: a standing panel that
 * states a position, with the thinking indicator only present while it is
 * genuinely still working.
 */
export function AIIntelligencePanel({
  summary,
  loading,
  empty,
}: {
  summary: string | null;
  loading: boolean;
  empty?: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-ink-100 bg-jade-50 px-5 py-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={cx(
              "size-1.5 rounded-full bg-jade-600",
              loading && "animate-pulse"
            )}
          />
          <h2 className="text-eyebrow uppercase text-jade-700">
            Financial intelligence
          </h2>
        </div>
        <Link
          href="/qa"
          className="text-label font-medium text-jade-700 underline-offset-4 hover:underline"
        >
          Ask a question
        </Link>
      </div>

      <div className="px-5 py-4">
        {loading ? (
          <div aria-live="polite" aria-busy="true">
            <p className="text-label text-ink-500">Reading your month…</p>
            <div className="mt-3 space-y-2" aria-hidden="true">
              <div className="skeleton h-2.5 w-full" />
              <div className="skeleton h-2.5 w-[92%]" />
              <div className="skeleton h-2.5 w-[64%]" />
            </div>
          </div>
        ) : summary ? (
          <p className="text-body leading-relaxed text-ink-700 animate-fade">
            {summary}
          </p>
        ) : (
          empty
        )}
      </div>
    </Card>
  );
}
