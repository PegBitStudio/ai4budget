"use client";

import { useEffect, useState } from "react";
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

  if (loading && summaryLoading) {
    return <LoadingState />;
  }

  const income = quickStats?.income ?? 0;
  const spending = quickStats?.spending ?? 0;
  const net = quickStats?.net ?? 0;
  const spentShare = income > 0 ? Math.min((spending / income) * 100, 100) : 0;
  const dateLabel = new Date().toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 pb-28 sm:px-6 md:px-8">
      <section className="relative overflow-hidden rounded-[2rem] bg-[#27235b] px-6 py-7 text-white shadow-[0_24px_60px_rgba(49,46,129,0.22)] sm:px-8 sm:py-9">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-violet-400/25 blur-2xl" />
        <div className="absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-emerald-300/15 blur-2xl" />
        <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-violet-200">Your money pulse · {dateLabel}</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              {net >= 0 ? "You’re in control." : "Let’s steady the month."}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-violet-100 sm:text-base">
              {income > 0
                ? `${formatCurrency(Math.max(net, 0))} is available after the spending you have logged.`
                : "Add your income and first expenses to see a personal money plan."}
            </p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4 backdrop-blur-sm lg:min-w-64">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-200">Available now</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight">{formatCurrency(net)}</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-emerald-300" style={{ width: `${spentShare}%` }} />
            </div>
            <p className="mt-2 text-xs text-violet-100">{spentShare.toFixed(0)}% of logged income spent</p>
          </div>
        </div>
      </section>

      {/* Active Alerts */}
      {alerts.length > 0 && (
        <section className="mt-6" aria-labelledby="alerts-heading">
          <h2 id="alerts-heading" className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">Needs attention</h2>
          <div className="space-y-2">
            {alerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-7 grid gap-4 lg:grid-cols-[1.35fr_0.65fr]" aria-labelledby="summary-heading">
        <div className="rounded-[1.5rem] border border-white bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-900" id="summary-heading">Your coach’s take</p>
              <p className="mt-1 text-sm text-slate-500">A plain-language view of your latest money activity.</p>
            </div>
            <Link href="/qa" className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100">Ask AI</Link>
          </div>
          <div className="mt-5 rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-50 p-4">
          {summaryLoading ? (
            <div className="h-16 animate-pulse rounded bg-gray-100" />
          ) : summary ? (
            <p className="text-sm leading-6 text-slate-700">{summary}</p>
          ) : (
            <EmptyState />
          )}
          </div>
        </div>

        <div className="rounded-[1.5rem] bg-emerald-400 p-5 text-emerald-950 shadow-sm sm:p-6">
          <p className="text-sm font-semibold">This month’s focus</p>
          <p className="mt-3 text-xl font-semibold tracking-tight">Build your spending plan before the next expense.</p>
          <p className="mt-2 text-sm leading-6 text-emerald-950/75">A budget turns today’s transactions into an intentional plan.</p>
          <Link href="/budget" className="mt-5 inline-flex rounded-xl bg-emerald-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-900">Create a budget</Link>
        </div>
      </section>

      {/* Quick Stats */}
      <section className="mt-7" aria-labelledby="stats-heading">
          <div className="mb-3 flex items-end justify-between">
            <div><h2 id="stats-heading" className="text-lg font-semibold tracking-tight text-slate-900">Your month at a glance</h2><p className="mt-1 text-sm text-slate-500">Track the fundamentals before you optimise.</p></div>
            <Link href="/transactions" className="text-sm font-semibold text-violet-700 hover:text-violet-900">View activity</Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              label="Total Income"
              value={formatCurrency(income)}
              variant="green"
            />
            <StatCard
              label="Total Spending"
              value={formatCurrency(spending)}
              variant="red"
            />
            <StatCard
              label="Net"
              value={formatCurrency(net)}
              variant={net >= 0 ? "green" : "red"}
            />
          </div>
      </section>

      {/* Charts Section */}
      <section className="mt-8" aria-labelledby="charts-heading">
        <h2
          id="charts-heading"
          className="text-lg font-semibold tracking-tight text-slate-900"
        >
          Spending Insights
        </h2>
        <p className="mt-1 text-sm text-slate-500">See where your money is going and how your habits are changing.</p>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Category Breakdown */}
          <div className="rounded-[1.5rem] border border-white bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">
              Category Breakdown
            </h3>
            <CategoryBreakdown data={categoryData} />
          </div>

          {/* Spending Trend */}
          <div className="rounded-[1.5rem] border border-white bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">
              Spending Trend
            </h3>
            <SpendingTrend data={trendData} />
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="mt-8" aria-labelledby="actions-heading">
        <h2 id="actions-heading" className="text-lg font-semibold tracking-tight text-slate-900">Take action</h2>
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
    <div className="rounded-2xl border border-white bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-[0.12em]">
        {label}
      </p>
      <p
        className={`mt-2 text-2xl font-semibold tracking-tight ${
          variant === "green" ? "text-emerald-600" : "text-rose-600"
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
      className="flex items-center gap-3 rounded-2xl border border-white bg-white p-4 shadow-sm hover:-translate-y-0.5 hover:bg-violet-50 transition-all min-h-[44px]"
    >
      <span className="rounded-xl bg-violet-100 p-2 text-violet-700">{icon}</span>
      <span className="text-sm font-semibold text-slate-900">{label}</span>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 text-blue-500">
          <path d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 9a.75.75 0 0 0-1.5 0v2.25H9a.75.75 0 0 0 0 1.5h2.25V15a.75.75 0 0 0 1.5 0v-2.25H15a.75.75 0 0 0 0-1.5h-2.25V9Z" />
        </svg>
      </div>
      <h3 className="text-sm font-medium text-gray-900 mb-1">
        Get started with your first transaction
      </h3>
      <p className="text-sm text-gray-500 mb-4 max-w-xs">
        Add income or expenses to see your AI-powered financial summary, spending insights, and budget recommendations.
      </p>
      <Link
        href="/budget"
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors min-h-[44px]"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
        </svg>
        Set up your budget
      </Link>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="px-4 py-4 sm:px-6 md:px-8">
      <div className="mt-4 space-y-4" aria-busy="true" aria-live="polite">
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
