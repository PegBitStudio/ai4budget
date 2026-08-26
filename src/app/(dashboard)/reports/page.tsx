"use client";

import { useCallback, useEffect, useState } from "react";
import { formatCurrency } from "@/utils/formatters";
import {
  Card,
  CardHeader,
  PageHeader,
  Button,
  Skeleton,
  EmptyState,
  cx,
} from "@/components/ui/primitives";
import { REPORT_KINDS, type Report, type ReportKind } from "@/lib/reportBuilder";

/**
 * Reports.
 *
 * Deliberately not a new set of numbers — every figure here is one the rest of
 * the product already shows, arranged for reading in one go rather than for
 * working in. That is the whole job: a month you can send to someone, or read
 * once and close.
 *
 * Nothing is generated in the background and nothing is stored. Pick a report
 * and a month and it is composed on the spot, which means it can never be
 * stale and there is never a second version of the truth to reconcile.
 */
export default function ReportsPage() {
  const [kind, setKind] = useState<ReportKind>("monthly-summary");
  const [month, setMonth] = useState(currentMonth());
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/reports?kind=${kind}&month=${month}`);
      if (!res.ok) {
        setError("Could not build that report.");
        return;
      }
      const data = await res.json();
      setReport(data.report);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, [kind, month]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="A month, written out. Pick what you want to read and when."
        actions={
          <Button
            variant="secondary"
            onClick={() => window.print()}
            disabled={!report || loading}
          >
            Print or save as PDF
          </Button>
        }
      />

      {/* Controls. Printed output drops them — they are not part of the report. */}
      <Card className="print:hidden">
        <div className="flex flex-wrap items-end gap-4 p-5">
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-label font-medium text-ink-700">Report</p>
            <div className="flex flex-wrap gap-2">
              {REPORT_KINDS.map((option) => (
                <button
                  key={option.kind}
                  onClick={() => setKind(option.kind)}
                  aria-pressed={kind === option.kind}
                  title={option.description}
                  className={cx(
                    "min-h-9 rounded-md border px-3.5 text-label font-medium transition-colors duration-[--duration-fast]",
                    kind === option.kind
                      ? "border-ink-900 bg-ink-900 text-paper"
                      : "border-ink-200 text-ink-600 hover:border-ink-300 hover:bg-ink-50 hover:text-ink-900"
                  )}
                >
                  {option.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="report-month"
              className="mb-2 block text-label font-medium text-ink-700"
            >
              Month
            </label>
            <input
              id="report-month"
              type="month"
              value={month}
              max={currentMonth()}
              onChange={(e) => setMonth(e.target.value)}
              className="min-h-9 rounded-md border border-ink-200 bg-paper px-3 text-label text-ink-900 transition-colors duration-[--duration-fast] focus:border-ink-900 focus:outline-none"
            />
          </div>
        </div>
      </Card>

      {error ? (
        <p role="alert" className="rounded-lg bg-negative-50 p-4 text-body text-negative-700">
          {error}
        </p>
      ) : loading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : report ? (
        <ReportView report={report} />
      ) : null}
    </div>
  );
}

function ReportView({ report }: { report: Report }) {
  const empty = report.sections.every((s) => s.lines.length === 0);

  return (
    <div className="animate-rise space-y-4">
      <Card>
        <div className="border-b border-ink-100 px-5 py-5 sm:px-6">
          <p className="text-eyebrow uppercase text-ink-500">
            {report.periodLabel}
          </p>
          <h2 className="mt-1.5 text-title text-ink-950">{report.title}</h2>
          <p className="mt-3 max-w-2xl text-body leading-relaxed text-ink-700 [text-wrap:pretty]">
            {report.headline}
          </p>
        </div>

        <dl className="grid gap-px bg-ink-100 sm:grid-cols-3">
          {report.summary.map((item) => (
            <div key={item.label} className="bg-paper px-5 py-4 sm:px-6">
              <dt className="text-eyebrow uppercase text-ink-500">
                {item.label}
              </dt>
              <dd className="mt-1.5 text-figure tnum text-ink-950">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      {empty ? (
        <EmptyState
          title="Nothing recorded for this month"
          description="Pick another month, or add some transactions and come back."
        />
      ) : (
        report.sections.map((section) => (
          <Card key={section.heading}>
            <CardHeader title={section.heading} />
            {section.lines.length === 0 ? (
              <p className="px-5 py-6 text-body text-ink-500">
                Nothing to show in this section.
              </p>
            ) : (
              <table className="w-full border-collapse">
                <tbody>
                  {section.lines.map((line) => (
                    <tr key={line.label} className="border-b border-ink-100 last:border-b-0">
                      <td className="py-3 pl-5 pr-3 text-body text-ink-900 sm:pl-6">
                        {line.label}
                      </td>
                      {line.share !== undefined && (
                        <td className="w-24 py-3 pr-3 text-right text-label tnum text-ink-500">
                          {Math.round(line.share)}%
                        </td>
                      )}
                      <td
                        className={cx(
                          "w-40 py-3 pr-5 text-right text-body font-medium tnum sm:pr-6",
                          line.value < 0 ? "text-positive-600" : "text-ink-900"
                        )}
                      >
                        {line.value < 0 ? "−" : ""}
                        {formatCurrency(Math.abs(line.value))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {section.total !== undefined && (
                  <tfoot>
                    <tr className="border-t border-ink-200">
                      <td className="py-3 pl-5 pr-3 text-label font-medium uppercase tracking-wide text-ink-500 sm:pl-6">
                        Total
                      </td>
                      {section.lines.some((l) => l.share !== undefined) && <td />}
                      <td className="py-3 pr-5 text-right text-body font-semibold tnum text-ink-950 sm:pr-6">
                        {formatCurrency(section.total)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            )}
          </Card>
        ))
      )}

      <p className="text-label leading-relaxed text-ink-500">
        Built from your own transactions for {report.periodLabel}. General
        budgeting support only — not professional financial or investment
        advice.
      </p>
    </div>
  );
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
