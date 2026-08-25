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
  percentage: number;
}

interface SummaryResponse {
  summary: string;
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

/** How many alerts the dashboard shows before deferring the rest to the budget page. */
const MAX_VISIBLE_ALERTS = 3;

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

  // The fast data — figures, charts and alerts — paints as soon as it lands.
  // The AI summary is a separate, much slower request and must never gate it.
  useEffect(() => {
    async function loadFigures() {
      // Build the date locally — toISOString() shifts by timezone and would
      // pull in the last day of the previous month for users ahead of UTC.
      const now = new Date();
      const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

      const [alertsRes, monthRes, historyRes] = await Promise.allSettled([
        fetch("/api/alerts"),
        fetch(`/api/transactions?from=${from}&limit=10000`),
        fetch("/api/transactions?type=expense&limit=10000"),
      ]);

      if (alertsRes.status === "fulfilled" && alertsRes.value.ok) {
        try {
          const alertsJson = await alertsRes.value.json();
          setAlerts(alertsJson.alerts ?? []);
        } catch {
          // Alerts are non-critical.
        }
      }

      if (monthRes.status === "fulfilled" && monthRes.value.ok) {
        try {
          const { transactions }: TransactionsResponse =
            await monthRes.value.json();

          const income = transactions
            .filter((t) => t.type === "income")
            .reduce((sum, t) => sum + t.amount, 0);
          const spending = transactions
            .filter((t) => t.type === "expense")
            .reduce((sum, t) => sum + t.amount, 0);

          setQuickStats({ income, spending, net: income - spending });

          // Full category breakdown from this month's expenses.
          const categoryMap = new Map<string, number>();
          for (const t of transactions) {
            if (t.type !== "expense") continue;
            categoryMap.set(
              t.category,
              (categoryMap.get(t.category) ?? 0) + t.amount
            );
          }
          const totalSpending = Array.from(categoryMap.values()).reduce(
            (a, b) => a + b,
            0
          );
          setCategoryData(
            Array.from(categoryMap.entries())
              .map(([category, amount]) => ({
                category,
                amount,
                percentage:
                  totalSpending > 0 ? (amount / totalSpending) * 100 : 0,
              }))
              .sort((a, b) => b.amount - a.amount)
          );
        } catch {
          // Leave the figures empty rather than breaking the page.
        }
      }

      if (historyRes.status === "fulfilled" && historyRes.value.ok) {
        try {
          const { transactions }: TransactionsResponse =
            await historyRes.value.json();

          const monthMap = new Map<string, number>();
          for (const t of transactions) {
            const month = t.date.substring(0, 7); // YYYY-MM
            monthMap.set(month, (monthMap.get(month) ?? 0) + t.amount);
          }

          setTrendData(
            Array.from(monthMap.entries())
              .sort(([a], [b]) => a.localeCompare(b))
              .slice(-12)
              .map(([period, amount]) => ({
                period: formatMonthLabel(period),
                amount,
              }))
          );
        } catch {
          // Trend is non-critical.
        }
      }

      setLoading(false);
    }

    loadFigures();
  }, []);

  // The AI narrative arrives on its own schedule and fills only its own card.
  useEffect(() => {
    async function loadSummary() {
      try {
        const res = await fetch("/api/summary");
        if (!res.ok) {
          setSummary(null);
          return;
        }
        const json: SummaryResponse = await res.json();
        setSummary(json.summary);
      } catch {
        setSummary(null);
      } finally {
        setSummaryLoading(false);
      }
    }

    loadSummary();
  }, []);

  if (loading) {
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
              {income === 0
                ? "Add your income and first expenses to see a personal money plan."
                : net >= 0
                  ? `${formatCurrency(net)} is still available after the spending you have logged.`
                  : `You have spent ${formatCurrency(Math.abs(net))} more than you earned this month.`}
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

      {/* Active alerts — worst first, capped so the page stays scannable */}
      {alerts.length > 0 && (
        <section className="mt-7" aria-labelledby="alerts-heading">
          <div className="mb-3 flex items-end justify-between gap-4">
            <h2
              id="alerts-heading"
              className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500"
            >
              Needs attention
            </h2>
            {alerts.length > MAX_VISIBLE_ALERTS && (
              <Link
                href="/budget"
                className="text-sm font-semibold text-violet-700 hover:text-violet-900"
              >
                {alerts.length - MAX_VISIBLE_ALERTS} more in your budget
              </Link>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {alerts.slice(0, MAX_VISIBLE_ALERTS).map((alert) => (
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
            <SummaryPending />
          ) : summary ? (
            <p className="text-sm leading-6 text-slate-700">{summary}</p>
          ) : (
            <EmptyState />
          )}
          </div>
        </div>

        <FocusCard alerts={alerts} hasSpending={spending > 0} />
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
  const fill = Math.min(alert.percentage, 100);

  return (
    <div
      className={`rounded-2xl border p-4 ${
        isExceeded
          ? "border-rose-200 bg-rose-50"
          : "border-amber-200 bg-amber-50"
      }`}
      role="alert"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p
          className={`text-sm font-semibold ${
            isExceeded ? "text-rose-900" : "text-amber-900"
          }`}
        >
          {alert.category}{" · "}
          <span className="font-normal">
            {isExceeded
              ? `over by ${formatCurrency(Math.abs(remaining))}`
              : `${formatCurrency(remaining)} left`}
          </span>
        </p>
        <p
          className={`text-sm font-semibold tabular-nums ${
            isExceeded ? "text-rose-700" : "text-amber-700"
          }`}
        >
          {alert.percentage.toFixed(0)}%
        </p>
      </div>

      <div
        className={`mt-2.5 h-1.5 overflow-hidden rounded-full ${
          isExceeded ? "bg-rose-200" : "bg-amber-200"
        }`}
      >
        <div
          className={`h-full rounded-full ${
            isExceeded ? "bg-rose-600" : "bg-amber-500"
          }`}
          style={{ width: `${fill}%` }}
        />
      </div>

      <p
        className={`mt-2 text-xs ${
          isExceeded ? "text-rose-700" : "text-amber-700"
        }`}
      >
        {formatCurrency(alert.amount_spent)} spent of{" "}
        {formatCurrency(alert.budgeted_amount)} planned
      </p>
    </div>
  );
}

/**
 * The one thing worth doing next, chosen from the user's actual state rather
 * than telling everyone to build a budget they may already have.
 */
function FocusCard({
  alerts,
  hasSpending,
}: {
  alerts: SpendingAlert[];
  hasSpending: boolean;
}) {
  const worst = alerts.find((a) => a.type === "exceeded") ?? alerts[0];

  if (worst) {
    const over = worst.amount_spent - worst.budgeted_amount;
    return (
      <div className="rounded-[1.5rem] bg-rose-500 p-5 text-white shadow-sm sm:p-6">
        <p className="text-sm font-semibold text-rose-50">This month’s focus</p>
        <p className="mt-3 text-xl font-semibold tracking-tight">
          {worst.type === "exceeded"
            ? `${worst.category} is ${formatCurrency(over)} past its plan.`
            : `${worst.category} is close to its limit.`}
        </p>
        <p className="mt-2 text-sm leading-6 text-rose-50/85">
          It is your largest gap this month. See what drove it, then adjust the
          plan or the habit.
        </p>
        <Link
          href="/analysis"
          className="mt-5 inline-flex rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
        >
          See what happened
        </Link>
      </div>
    );
  }

  if (!hasSpending) {
    return (
      <div className="rounded-[1.5rem] bg-violet-600 p-5 text-white shadow-sm sm:p-6">
        <p className="text-sm font-semibold text-violet-100">Start here</p>
        <p className="mt-3 text-xl font-semibold tracking-tight">
          Log your first few expenses.
        </p>
        <p className="mt-2 text-sm leading-6 text-violet-100/85">
          A handful of transactions is enough for the assistant to start finding
          patterns.
        </p>
        <Link
          href="/transactions"
          className="mt-5 inline-flex rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-violet-700 transition hover:bg-violet-50"
        >
          Add a transaction
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-[1.5rem] bg-emerald-400 p-5 text-emerald-950 shadow-sm sm:p-6">
      <p className="text-sm font-semibold">This month’s focus</p>
      <p className="mt-3 text-xl font-semibold tracking-tight">
        Every category is inside its plan.
      </p>
      <p className="mt-2 text-sm leading-6 text-emerald-950/75">
        Good month. Put the difference toward a savings goal while it is still
        there.
      </p>
      <Link
        href="/savings"
        className="mt-5 inline-flex rounded-xl bg-emerald-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-900"
      >
        Review your savings
      </Link>
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

/**
 * Shown while the AI narrative is still being written. The rest of the
 * dashboard is already on screen by this point, so this reads as one card
 * catching up rather than the page being stuck.
 */
function SummaryPending() {
  return (
    <div aria-live="polite" aria-busy="true">
      <p className="flex items-center gap-2 text-sm font-medium text-violet-800">
        <span className="flex gap-1" aria-hidden="true">
          <Dot delay="0ms" />
          <Dot delay="150ms" />
          <Dot delay="300ms" />
        </span>
        Reading your month…
      </p>
      <div className="mt-3 space-y-2" aria-hidden="true">
        <div className="h-2.5 w-full animate-pulse rounded-full bg-violet-200/70" />
        <div className="h-2.5 w-[92%] animate-pulse rounded-full bg-violet-200/70" />
        <div className="h-2.5 w-[64%] animate-pulse rounded-full bg-violet-200/70" />
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-500"
      style={{ animationDelay: delay }}
    />
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
