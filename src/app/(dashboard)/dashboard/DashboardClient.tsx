"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CategoryBreakdown, SpendingTrend } from "@/components/charts";
import type {
  CategoryBreakdownData,
  SpendingTrendData,
} from "@/components/charts";
import { formatCurrency } from "@/utils/formatters";
import {
  Card,
  CardHeader,
  PageHeader,
  Section,
  Badge,
  Button,
  LinkButton,
  EmptyState,
  Skeleton,
  cx,
} from "@/components/ui/primitives";
import FinancialMetricCard from "@/components/finance/FinancialMetricCard";
import NetPositionHero from "@/components/finance/NetPositionHero";
import AIInsightCard, {
  AIIntelligencePanel,
  type Insight,
} from "@/components/finance/AIInsightCard";

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

interface Txn {
  id: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  date: string;
}

interface TransactionsResponse {
  transactions: Txn[];
  total: number;
}

/** Alerts shown here before the rest are deferred to the budget page. */
const MAX_VISIBLE_ALERTS = 3;

// --- Component -------------------------------------------------------------

export default function DashboardClient() {
  const [alerts, setAlerts] = useState<SpendingAlert[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [stats, setStats] = useState<{
    income: number;
    spending: number;
    net: number;
    previousSpending: number | null;
    previousIncome: number | null;
  } | null>(null);
  const [categoryData, setCategoryData] = useState<CategoryBreakdownData[]>([]);
  const [trendData, setTrendData] = useState<SpendingTrendData[]>([]);
  const [monthlyTotals, setMonthlyTotals] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  // The figures, charts and alerts paint as soon as they land. The AI summary
  // is a separate, much slower request and must never gate them.
  useEffect(() => {
    async function loadFigures() {
      const now = new Date();
      // Built from local parts — toISOString() shifts by timezone and would
      // pull in the last day of the previous month for users ahead of UTC.
      const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

      const [alertsRes, monthRes, historyRes] = await Promise.allSettled([
        fetch("/api/alerts"),
        fetch(`/api/transactions?from=${from}&limit=10000`),
        fetch("/api/transactions?limit=10000"),
      ]);

      if (alertsRes.status === "fulfilled" && alertsRes.value.ok) {
        try {
          const json = await alertsRes.value.json();
          setAlerts(json.alerts ?? []);
        } catch {
          // Alerts are non-critical.
        }
      }

      let income = 0;
      let spending = 0;

      if (monthRes.status === "fulfilled" && monthRes.value.ok) {
        try {
          const { transactions }: TransactionsResponse =
            await monthRes.value.json();

          income = sum(transactions.filter((t) => t.type === "income"));
          spending = sum(transactions.filter((t) => t.type === "expense"));

          setCategoryData(buildCategoryBreakdown(transactions));
        } catch {
          // Leave the figures empty rather than breaking the page.
        }
      }

      // The previous month, so every headline figure carries a comparison
      // rather than sitting on screen without context.
      let previousSpending: number | null = null;
      let previousIncome: number | null = null;

      if (historyRes.status === "fulfilled" && historyRes.value.ok) {
        try {
          const { transactions }: TransactionsResponse =
            await historyRes.value.json();

          const previousKey = monthKey(
            new Date(now.getFullYear(), now.getMonth() - 1, 1)
          );
          const previous = transactions.filter((t) =>
            t.date.startsWith(previousKey)
          );

          if (previous.length > 0) {
            previousIncome = sum(previous.filter((t) => t.type === "income"));
            previousSpending = sum(previous.filter((t) => t.type === "expense"));
          }

          const expenses = transactions.filter((t) => t.type === "expense");
          const byMonth = groupByMonth(expenses);
          setTrendData(
            byMonth.map(([period, amount]) => ({
              period: formatMonthLabel(period),
              amount,
            }))
          );
          setMonthlyTotals(byMonth.map(([, amount]) => amount));
        } catch {
          // Trend is non-critical.
        }
      }

      setStats({
        income,
        spending,
        net: income - spending,
        previousIncome,
        previousSpending,
      });
      setLoading(false);
    }

    loadFigures();
  }, []);

  // The AI narrative arrives on its own schedule and fills only its own panel.
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

  const income = stats?.income ?? 0;
  const spending = stats?.spending ?? 0;
  const net = stats?.net ?? 0;
  const savingsRate = income > 0 ? (net / income) * 100 : 0;

  const monthLabel = new Date().toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <PageHeader
        eyebrow={monthLabel}
        title={greeting()}
        description={
          loading
            ? "Reading your accounts…"
            : headline(income, net, spending)
        }
        actions={
          <LinkButton href="/transactions" variant="primary" size="sm">
            Add transaction
          </LinkButton>
        }
      />

      {/* The month's headline, on the one rich surface in the product */}
      <NetPositionHero
        net={net}
        income={income}
        spending={spending}
        spendingDelta={percentChange(spending, stats?.previousSpending ?? null)}
        loading={loading}
      />

      {/* Supporting figures */}
      <div className="mt-3 grid gap-3 stagger sm:grid-cols-3">
        <FinancialMetricCard
          label="Income"
          value={income}
          delta={percentChange(income, stats?.previousIncome ?? null)}
          caption="vs last month"
          loading={loading}
        />
        <FinancialMetricCard
          label="Spending"
          value={spending}
          delta={percentChange(spending, stats?.previousSpending ?? null)}
          invertDelta
          caption="vs last month"
          spark={monthlyTotals.length > 1 ? { points: monthlyTotals } : undefined}
          loading={loading}
        />
        <FinancialMetricCard
          label="Savings rate"
          value={income > 0 ? savingsRate : 0}
          format="percent"
          tone={savingsRate >= 0 ? "positive" : "negative"}
          caption={
            income > 0 ? "of income kept" : "Add income to see this"
          }
          loading={loading}
        />
      </div>

      {/* Intelligence + the single most useful next step */}
      <Section className="mt-6">
        <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
          <AIIntelligencePanel
            summary={summary}
            loading={summaryLoading}
            empty={
              <EmptyState
                title="Nothing to read yet"
                description="Add your income and a few expenses and the assistant will tell you what it sees."
                action={
                  <Link href="/transactions">
                    <Button variant="primary" size="sm">
                      Add transactions
                    </Button>
                  </Link>
                }
              />
            }
          />
          <AIInsightCard insight={buildFocusInsight(alerts, spending, net)} />
        </div>
      </Section>

      {/* Budget pressure */}
      {alerts.length > 0 && (
        <Section
          title="Needs attention"
          description="Categories at or beyond their planned amount."
          action={
            alerts.length > MAX_VISIBLE_ALERTS ? (
              <Link
                href="/budget"
                className="text-label font-medium text-ink-700 underline-offset-4 hover:underline"
              >
                View all {alerts.length}
              </Link>
            ) : undefined
          }
        >
          <div className="grid gap-3 stagger sm:grid-cols-3">
            {alerts.slice(0, MAX_VISIBLE_ALERTS).map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </Section>
      )}

      {/* Visualisations */}
      <Section title="Where it went" description="This month, by category and over time.">
        <div className="grid gap-3 lg:grid-cols-2">
          <Card>
            <CardHeader title="Category breakdown" />
            <div className="p-5">
              {loading ? (
                <Skeleton className="h-[260px] w-full" />
              ) : (
                <CategoryBreakdown data={categoryData} />
              )}
            </div>
          </Card>
          <Card>
            <CardHeader title="Spending over time" />
            <div className="p-5">
              {loading ? (
                <Skeleton className="h-[260px] w-full" />
              ) : (
                <SpendingTrend data={trendData} />
              )}
            </div>
          </Card>
        </div>
      </Section>
    </>
  );
}

// --- Pieces ----------------------------------------------------------------

function AlertCard({ alert }: { alert: SpendingAlert }) {
  const exceeded = alert.type === "exceeded";
  const remaining = alert.budgeted_amount - alert.amount_spent;
  const fill = Math.min(alert.percentage, 100);

  return (
    <Card className="p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-body font-medium text-ink-900">{alert.category}</p>
        <Badge tone={exceeded ? "negative" : "warning"}>
          {Math.round(alert.percentage)}%
        </Badge>
      </div>

      <div className="mt-3 h-1 overflow-hidden rounded-full bg-ink-100">
        <div
          className={cx(
            "h-full rounded-full transition-[width] duration-[--duration-slow] ease-[--ease-out-quart]",
            exceeded ? "bg-negative-600" : "bg-warning-600"
          )}
          style={{ width: `${fill}%` }}
        />
      </div>

      <p className="mt-2 text-label tnum text-ink-500">
        <span className="text-ink-900">
          {formatCurrency(alert.amount_spent)}
        </span>{" "}
        of {formatCurrency(alert.budgeted_amount)}
        {" · "}
        <span className={exceeded ? "text-negative-600" : "text-warning-700"}>
          {exceeded
            ? `${formatCurrency(Math.abs(remaining))} over`
            : `${formatCurrency(remaining)} left`}
        </span>
      </p>
    </Card>
  );
}

// --- Derivations -----------------------------------------------------------

function sum(rows: Txn[]): number {
  return rows.reduce((total, t) => total + t.amount, 0);
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function percentChange(current: number, previous: number | null): number | null {
  if (previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function groupByMonth(expenses: Txn[]): [string, number][] {
  const map = new Map<string, number>();
  for (const t of expenses) {
    const key = t.date.slice(0, 7);
    map.set(key, (map.get(key) ?? 0) + t.amount);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12);
}

function buildCategoryBreakdown(transactions: Txn[]): CategoryBreakdownData[] {
  const map = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== "expense") continue;
    map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
  }
  const total = Array.from(map.values()).reduce((a, b) => a + b, 0);
  return Array.from(map.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: total > 0 ? (amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function headline(income: number, net: number, spending: number): string {
  if (income === 0 && spending === 0) {
    return "Add your income and first expenses to see where your money goes.";
  }
  if (net < 0) {
    return `You have spent ${formatCurrency(Math.abs(net))} more than you earned this month.`;
  }
  return `${formatCurrency(net)} is still available after the spending you have logged.`;
}

/**
 * The one thing worth doing next, chosen from actual state rather than telling
 * every user to build a budget they may already have.
 */
function buildFocusInsight(
  alerts: SpendingAlert[],
  spending: number,
  net: number
): Insight {
  const worst = alerts.find((a) => a.type === "exceeded") ?? alerts[0];

  if (worst) {
    const over = worst.amount_spent - worst.budgeted_amount;
    return {
      kind: "alert",
      headline:
        worst.type === "exceeded"
          ? `${worst.category} is past its plan`
          : `${worst.category} is close to its limit`,
      detail:
        "It is your largest gap this month. See what drove it, then adjust either the plan or the habit.",
      impact:
        worst.type === "exceeded"
          ? `${formatCurrency(over)} over plan`
          : `${formatCurrency(worst.budgeted_amount - worst.amount_spent)} left`,
      action: { label: "See what happened", href: "/analysis" },
    };
  }

  if (spending === 0) {
    return {
      kind: "opportunity",
      headline: "Start with a few expenses",
      detail:
        "A handful of transactions is enough for the assistant to start finding patterns in how you spend.",
      action: { label: "Add transactions", href: "/transactions" },
    };
  }

  return {
    kind: "achievement",
    headline: "Every category is inside its plan",
    detail:
      "A good month. Moving the difference into a savings goal while it is still there is the highest-value thing you can do now.",
    impact: net > 0 ? `${formatCurrency(net)} available` : undefined,
    action: { label: "Review your goals", href: "/savings" },
  };
}

function formatMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  return new Date(Number(year), Number(month) - 1).toLocaleDateString(undefined, {
    month: "short",
    year: "2-digit",
  });
}
