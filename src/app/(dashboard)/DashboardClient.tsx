"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { CategoryBreakdown } from "@/components/charts";
import type { CategoryBreakdownData } from "@/components/charts";
import { SpendingTrend } from "@/components/charts";
import type { SpendingTrendData } from "@/components/charts";
import { formatCurrency } from "@/utils/formatters";

// --- Types ---

interface SpendingAlert {
  id: string;
  category: string;
  type: "warning" | "exceeded";
  amount_spent: number;
  budgeted_amount: number;
  period_start: string;
}

interface SummaryResponse {
  summary: string;
  data?: {
    totalIncome: number;
    totalExpenses: number;
    net: number;
    topCategories: { category: string; amount: number; percentage: number }[];
  };
}

interface TransactionsResponse {
  transactions: {
    id: string;
    amount: number;
    type: "income" | "expense";
    category: string;
    date: string;
  }[];
  total: number;
}

// --- Main Dashboard Component ---

export default function DashboardClient() {
  const [disclaimerAcknowledged, setDisclaimerAcknowledged] = useState(true);
  const [alerts, setAlerts] = useState<SpendingAlert[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [quickStats, setQuickStats] = useState<{
    income: number;
    spending: number;
    net: number;
  } | null>(null);
  const [categoryData, setCategoryData] = useState<CategoryBreakdownData[]>([]);
  const [trendData, setTrendData] = useState<SpendingTrendData[]>([]);
  const [loading, setLoading] = useState(true);

  // Check disclaimer on mount
  useEffect(() => {
    const acknowledged = localStorage.getItem("disclaimer_acknowledged");
    setDisclaimerAcknowledged(acknowledged === "true");
  }, []);

  const acknowledgeDisclaimer = useCallback(() => {
    localStorage.setItem("disclaimer_acknowledged", "true");
    setDisclaimerAcknowledged(true);
  }, []);

  // Fetch dashboard data
  useEffect(() => {
    async function fetchDashboardData() {
      setLoading(true);

      // Fetch alerts
      try {
        const alertsRes = await fetch("/api/alerts");
        if (alertsRes.ok) {
          const alertsJson = await alertsRes.json();
          setAlerts(alertsJson.alerts ?? []);
        }
      } catch {
        // Alerts are non-critical, continue
      }

      // Fetch summary
      setSummaryLoading(true);
      try {
        const summaryRes = await fetch("/api/summary");
        if (summaryRes.ok) {
          const summaryJson: SummaryResponse = await summaryRes.json();
          setSummary(summaryJson.summary);
          if (summaryJson.data) {
            setQuickStats({
              income: summaryJson.data.totalIncome,
              spending: summaryJson.data.totalExpenses,
              net: summaryJson.data.net,
            });
            // Build category breakdown from summary data
            if (summaryJson.data.topCategories) {
              setCategoryData(
                summaryJson.data.topCategories.map((tc) => ({
                  category: tc.category,
                  amount: tc.amount,
                  percentage: tc.percentage,
                }))
              );
            }
          }
        } else {
          setSummary(null);
        }
      } catch {
        setSummary(null);
      } finally {
        setSummaryLoading(false);
      }

      // Fetch transactions for quick stats fallback and trend
      try {
        const now = new Date();
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const from = firstOfMonth.toISOString().split("T")[0];

        const txRes = await fetch(
          `/api/transactions?from=${from}&limit=10000`
        );
        if (txRes.ok) {
          const txJson: TransactionsResponse = await txRes.json();
          const transactions = txJson.transactions;

          // Calculate quick stats if not already set from summary
          const income = transactions
            .filter((t) => t.type === "income")
            .reduce((sum, t) => sum + t.amount, 0);
          const spending = transactions
            .filter((t) => t.type === "expense")
            .reduce((sum, t) => sum + t.amount, 0);

          setQuickStats((prev) =>
            prev ?? { income, spending, net: income - spending }
          );

          // Build category breakdown if not already set from summary
          setCategoryData((prev) => {
            if (prev.length > 0) return prev;
            const categoryMap = new Map<string, number>();
            transactions
              .filter((t) => t.type === "expense")
              .forEach((t) => {
                categoryMap.set(
                  t.category,
                  (categoryMap.get(t.category) ?? 0) + t.amount
                );
              });
            const totalSpending = Array.from(categoryMap.values()).reduce(
              (a, b) => a + b,
              0
            );
            return Array.from(categoryMap.entries())
              .map(([category, amount]) => ({
                category,
                amount,
                percentage:
                  totalSpending > 0 ? (amount / totalSpending) * 100 : 0,
              }))
              .sort((a, b) => b.amount - a.amount);
          });
        }
      } catch {
        // Non-critical
      }

      // Fetch spending trend (aggregate by month from transactions)
      try {
        const txAllRes = await fetch(`/api/transactions?type=expense&limit=10000`);
        if (txAllRes.ok) {
          const txAllJson: TransactionsResponse = await txAllRes.json();
          const transactions = txAllJson.transactions;

          // Group by month
          const monthMap = new Map<string, number>();
          transactions.forEach((t) => {
            const month = t.date.substring(0, 7); // YYYY-MM
            monthMap.set(month, (monthMap.get(month) ?? 0) + t.amount);
          });

          const sortedMonths = Array.from(monthMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(-12); // Last 12 months

          setTrendData(
            sortedMonths.map(([period, amount]) => ({
              period: formatMonthLabel(period),
              amount,
            }))
          );
        }
      } catch {
        // Non-critical
      }

      setLoading(false);
    }

    fetchDashboardData();
  }, []);

  // Disclaimer modal
  if (!disclaimerAcknowledged) {
    return <DisclaimerModal onAcknowledge={acknowledgeDisclaimer} />;
  }

  if (loading && summaryLoading) {
    return <LoadingState />;
  }

  return (
    <div className="px-4 py-6 sm:px-6 md:px-8 pb-24">
      <h1 className="text-xl font-semibold text-gray-900 sm:text-2xl">
        Dashboard
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        Your financial overview at a glance.
      </p>

      {/* Active Alerts */}
      {alerts.length > 0 && (
        <section className="mt-4" aria-labelledby="alerts-heading">
          <h2 id="alerts-heading" className="sr-only">
            Budget Alerts
          </h2>
          <div className="space-y-2">
            {alerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </section>
      )}

      {/* Financial Summary */}
      <section className="mt-6" aria-labelledby="summary-heading">
        <h2
          id="summary-heading"
          className="text-lg font-medium text-gray-900"
        >
          Financial Summary
        </h2>
        <div className="mt-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          {summaryLoading ? (
            <div className="h-16 animate-pulse rounded bg-gray-100" />
          ) : summary ? (
            <p className="text-sm text-gray-700 leading-relaxed">{summary}</p>
          ) : (
            <p className="text-sm text-gray-500 italic">
              Add some transactions to get started with your financial summary.
            </p>
          )}
        </div>
      </section>

      {/* Quick Stats */}
      {quickStats && (
        <section className="mt-6" aria-labelledby="stats-heading">
          <h2 id="stats-heading" className="sr-only">
            Quick Stats
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              label="Total Income"
              value={formatCurrency(quickStats.income)}
              variant="green"
            />
            <StatCard
              label="Total Spending"
              value={formatCurrency(quickStats.spending)}
              variant="red"
            />
            <StatCard
              label="Net"
              value={formatCurrency(quickStats.net)}
              variant={quickStats.net >= 0 ? "green" : "red"}
            />
          </div>
        </section>
      )}

      {/* Charts Section */}
      <section className="mt-6" aria-labelledby="charts-heading">
        <h2
          id="charts-heading"
          className="text-lg font-medium text-gray-900"
        >
          Spending Insights
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Category Breakdown */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              Category Breakdown
            </h3>
            <CategoryBreakdown data={categoryData} />
          </div>

          {/* Spending Trend */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              Spending Trend
            </h3>
            <SpendingTrend data={trendData} />
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="mt-6" aria-labelledby="actions-heading">
        <h2 id="actions-heading" className="sr-only">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <QuickActionLink
            href="/transactions"
            label="Add Transaction"
            icon={
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
            }
          />
          <QuickActionLink
            href="/budget"
            label="View Budget"
            icon={
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5"
                />
              </svg>
            }
          />
          <QuickActionLink
            href="/qa"
            label="Ask AI"
            icon={
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
                />
              </svg>
            }
          />
        </div>
      </section>
    </div>
  );
}

// --- Sub-Components ---

function DisclaimerModal({ onAcknowledge }: { onAcknowledge: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="disclaimer-title"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2
          id="disclaimer-title"
          className="text-lg font-semibold text-gray-900"
        >
          Important Disclaimer
        </h2>
        <div className="mt-4 space-y-3 text-sm text-gray-700 leading-relaxed">
          <p>
            This application provides general budgeting support and does not
            constitute professional financial, investment, tax, or legal advice.
          </p>
          <p>
            The information, analysis, and recommendations provided are for
            educational and informational purposes only. Always consult a
            qualified financial professional before making significant financial
            decisions.
          </p>
          <p>
            By continuing, you acknowledge that you understand these limitations
            and agree to use this tool as a supplementary budgeting aid only.
          </p>
        </div>
        <button
          onClick={onAcknowledge}
          className="mt-6 w-full rounded-md bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 min-h-[44px]"
        >
          I Understand — Continue
        </button>
      </div>
    </div>
  );
}

function AlertCard({ alert }: { alert: SpendingAlert }) {
  const isExceeded = alert.type === "exceeded";
  const remaining = alert.budgeted_amount - alert.amount_spent;

  return (
    <div
      className={`rounded-lg border p-3 ${
        isExceeded
          ? "border-red-200 bg-red-50"
          : "border-amber-200 bg-amber-50"
      }`}
      role="alert"
    >
      <div className="flex items-center gap-2">
        <span
          className={`text-sm font-medium ${
            isExceeded ? "text-red-800" : "text-amber-800"
          }`}
        >
          {isExceeded ? "⚠️ Budget Exceeded" : "⚡ Approaching Limit"}
        </span>
        <span className="text-xs text-gray-600">— {alert.category}</span>
      </div>
      <p
        className={`mt-1 text-xs ${
          isExceeded ? "text-red-700" : "text-amber-700"
        }`}
      >
        Spent {formatCurrency(alert.amount_spent)} of{" "}
        {formatCurrency(alert.budgeted_amount)} budget
        {isExceeded
          ? ` (over by ${formatCurrency(Math.abs(remaining))})`
          : ` (${formatCurrency(remaining)} remaining)`}
      </p>
    </div>
  );
}

function StatCard({
  label,
  value,
  variant,
}: {
  label: string;
  value: string;
  variant: "green" | "red";
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        {label}
      </p>
      <p
        className={`mt-1 text-lg font-semibold ${
          variant === "green" ? "text-green-700" : "text-red-700"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function QuickActionLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:border-blue-300 hover:bg-blue-50 transition-colors min-h-[44px]"
    >
      <span className="text-blue-600">{icon}</span>
      <span className="text-sm font-medium text-gray-900">{label}</span>
    </Link>
  );
}

function LoadingState() {
  return (
    <div className="px-4 py-6 sm:px-6 md:px-8">
      <h1 className="text-xl font-semibold text-gray-900 sm:text-2xl">
        Dashboard
      </h1>
      <div className="mt-6 space-y-4" aria-busy="true" aria-live="polite">
        <div className="h-20 animate-pulse rounded-lg bg-gray-100" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-lg bg-gray-100" />
        <p className="text-center text-sm text-gray-500">
          Loading your financial overview…
        </p>
      </div>
    </div>
  );
}

// --- Helpers ---

function formatMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString(undefined, {
    month: "short",
    year: "2-digit",
  });
}
