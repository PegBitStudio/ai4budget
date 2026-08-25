"use client";

import { useEffect, useState } from "react";
import { formatCurrency, formatPercentage } from "@/utils/formatters";
import RecurringCharges from "@/components/analysis/RecurringCharges";
import type { RecurringSummary } from "@/components/analysis/RecurringCharges";

interface AnomalyData {
  transaction: {
    id: string;
    amount: number;
    category: string;
    date: string;
    description: string;
  };
  categoryAverage: number;
  multiple: number;
  explanation: string;
  goalImpact: GoalImpact | null;
}

interface GoalImpact {
  monthsDelayed: number;
  monthlyRate: number;
  label: string;
}

interface TrendData {
  category: string;
  previousAmount: number;
  currentAmount: number;
  percentageChange: number;
  explanation: string;
}

interface AnalysisResponse {
  anomalies: AnomalyData[];
  trends: TrendData[];
  recurring?: RecurringSummary;
  hasPatterns: boolean;
  message?: string;
}

export default function AnalysisPage() {
  const [data, setData] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAnalysis() {
      try {
        const res = await fetch("/api/analysis");

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Failed to fetch spending analysis");
        }

        const json: AnalysisResponse = await res.json();
        setData(json);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "An unexpected error occurred"
        );
      } finally {
        setLoading(false);
      }
    }

    fetchAnalysis();
  }, []);

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (data && !data.hasPatterns) {
    return <NoPatternsState />;
  }

  return (
    <div className="px-4 py-4 sm:px-6 md:px-8">
      <p className="text-sm text-gray-600">
        Unusual transactions and spending trends for this period.
      </p>

      {/* Anomalies Section */}
      {data && data.anomalies.length > 0 && (
        <section className="mt-6" aria-labelledby="anomalies-heading">
          <h2
            id="anomalies-heading"
            className="text-lg font-medium text-gray-900"
          >
            Unusual Transactions
          </h2>
          <div className="mt-3 space-y-3">
            {data.anomalies.map((anomaly) => (
              <AnomalyCard key={anomaly.transaction.id} anomaly={anomaly} />
            ))}
          </div>
        </section>
      )}

      {/* Trends Section */}
      {data && data.trends.length > 0 && (
        <section className="mt-8" aria-labelledby="trends-heading">
          <h2
            id="trends-heading"
            className="text-lg font-medium text-gray-900"
          >
            Increasing Spend Categories
          </h2>
          <div className="mt-3 space-y-3">
            {data.trends.map((trend) => (
              <TrendCard key={trend.category} trend={trend} />
            ))}
          </div>
        </section>
      )}

      {data?.recurring && <RecurringCharges summary={data.recurring} />}
    </div>
  );
}

function AnomalyCard({ anomaly }: { anomaly: AnomalyData }) {
  const { transaction, explanation } = anomaly;
  const formattedDate = new Date(transaction.date).toLocaleDateString(
    undefined,
    { year: "numeric", month: "short", day: "numeric" }
  );

  return (
    <article
      className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm"
      aria-label={`Unusual transaction: ${transaction.description}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-gray-900">
            {transaction.description}
          </p>
          <p className="mt-0.5 text-sm text-gray-600">
            {transaction.category} &middot; {formattedDate}
          </p>
        </div>
        <span className="shrink-0 text-lg font-semibold text-amber-800">
          {formatCurrency(transaction.amount)}
        </span>
      </div>
      <p className="mt-2 text-sm text-amber-700">{explanation}</p>

      {/* What it cost in progress, not just in Naira. A figure is an
          abstraction; a delay to something you are saving for is a decision. */}
      {anomaly.goalImpact && (
        <p className="mt-2 flex items-start gap-1.5 border-t border-amber-200 pt-2 text-sm font-medium text-amber-900">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="mt-0.5 h-4 w-4 shrink-0"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z"
              clipRule="evenodd"
            />
          </svg>
          <span>
            That is {anomaly.goalImpact.label} further from your savings goal,
            at the {formatCurrency(anomaly.goalImpact.monthlyRate)} a month you
            are putting aside.
          </span>
        </p>
      )}
    </article>
  );
}

function TrendCard({ trend }: { trend: TrendData }) {
  return (
    <article
      className="rounded-lg border border-purple-200 bg-purple-50 p-4 shadow-sm"
      aria-label={`Spending trend: ${trend.category}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-gray-900">{trend.category}</p>
        <span className="shrink-0 rounded-full bg-purple-100 px-2.5 py-0.5 text-sm font-semibold text-purple-800">
          +{formatPercentage(trend.percentageChange, 0)}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
        <span>{formatCurrency(trend.previousAmount)}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4 text-purple-500"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z"
            clipRule="evenodd"
          />
        </svg>
        <span className="font-medium text-purple-800">
          {formatCurrency(trend.currentAmount)}
        </span>
      </div>
      <p className="mt-2 text-sm text-purple-700">{trend.explanation}</p>
    </article>
  );
}

function LoadingState() {
  return (
    <div className="px-4 py-6 sm:px-6 md:px-8">
      <div className="mt-4 space-y-4" aria-busy="true" aria-live="polite">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-lg bg-gray-100"
          />
        ))}
        <p className="text-center text-sm text-gray-500">
          Analysing your spending patterns…
        </p>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="px-4 py-4 sm:px-6 md:px-8">
      <div
        role="alert"
        className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4"
      >
        <p className="font-medium text-red-800">Unable to load analysis</p>
        <p className="mt-1 text-sm text-red-700">{message}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-3 inline-flex items-center rounded-md bg-red-100 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 min-h-[44px]"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

function NoPatternsState() {
  return (
    <div className="px-4 py-4 sm:px-6 md:px-8">
      <div className="mt-4 flex flex-col items-center rounded-lg border border-gray-200 bg-white p-8 text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className="h-12 w-12 text-green-500"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <h2 className="mt-4 text-lg font-medium text-gray-900">
          All looks good!
        </h2>
        <p className="mt-2 max-w-sm text-sm text-gray-600">
          No unusual spending patterns were found for this period. Your spending
          is consistent with your usual habits.
        </p>
      </div>
    </div>
  );
}
