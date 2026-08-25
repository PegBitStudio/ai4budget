'use client';

import { useState, useEffect, useCallback } from 'react';
import BudgetProgress from '@/components/budget/BudgetProgress';

// --- Types ---

interface CategoryAllocation {
  category: string;
  amount: number;
  is_fixed: boolean;
}

interface Budget {
  id: string;
  user_id: string;
  period_type: 'weekly' | 'monthly';
  period_start: string;
  period_end: string;
  total_income: number;
  allocations: CategoryAllocation[];
  created_at: string;
}

interface BudgetComparison {
  category: string;
  budgeted: number;
  actual: number;
  variance: number;
  status: 'under' | 'on-track' | 'over';
}

// --- Helpers ---

function formatCurrency(amount: number): string {
  const formatted = Math.abs(amount)
    .toFixed(2)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sign = amount < 0 ? '-' : '';
  return `${sign}₦${formatted}`;
}

/**
 * Renders a period as "1 – 31 August 2026", collapsing the repeated month and
 * year rather than printing two raw ISO dates at the user.
 */
function formatPeriod(start: string, end: string): string {
  const from = parseLocalDate(start);
  const to = parseLocalDate(end);

  const sameMonth =
    from.getFullYear() === to.getFullYear() &&
    from.getMonth() === to.getMonth();

  const monthYear = (d: Date) =>
    d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  if (sameMonth) {
    return `${from.getDate()} – ${to.getDate()} ${monthYear(to)}`;
  }

  const dayMonth = (d: Date) =>
    d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

  return `${dayMonth(from)} – ${dayMonth(to)} ${to.getFullYear()}`;
}

function parseLocalDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getStatusColor(status: 'under' | 'on-track' | 'over'): string {
  switch (status) {
    case 'under':
      return 'text-green-700 bg-green-50 border-green-200';
    case 'on-track':
      return 'text-amber-700 bg-amber-50 border-amber-200';
    case 'over':
      return 'text-red-700 bg-red-50 border-red-200';
  }
}

function getStatusLabel(status: 'under' | 'on-track' | 'over'): string {
  switch (status) {
    case 'under':
      return 'Under Budget';
    case 'on-track':
      return 'On Track';
    case 'over':
      return 'Over Budget';
  }
}

// --- Component ---

export default function BudgetPage() {
  const [budget, setBudget] = useState<Budget | null>(null);
  const [comparison, setComparison] = useState<BudgetComparison[] | null>(null);
  const [periodType, setPeriodType] = useState<'weekly' | 'monthly'>('monthly');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shortfall, setShortfall] = useState<number | null>(null);
  const [errorReason, setErrorReason] = useState<'no-income' | 'shortfall' | null>(null);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [saving, setSaving] = useState(false);

  // Fetch existing budget for the selected period
  const fetchBudget = useCallback(async () => {
    setLoading(true);
    setError(null);
    setShortfall(null);
    setErrorReason(null);

    try {
      const res = await fetch(`/api/budget?period_type=${periodType}`);

      if (res.status === 404) {
        // No budget exists for this period
        setBudget(null);
        setComparison(null);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch budget');
      }

      const budgetData: Budget = await res.json();
      setBudget(budgetData);

      // Fetch comparison data from analysis endpoint
      await fetchComparison(budgetData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setBudget(null);
      setComparison(null);
    } finally {
      setLoading(false);
    }
  }, [periodType]);

  // Fetch spending comparison for the current budget
  const fetchComparison = async (budgetData: Budget) => {
    try {
      const res = await fetch(`/api/analysis?period_type=${budgetData.period_type}`);
      if (res.ok) {
        const data = await res.json();
        if (data.comparison) {
          setComparison(data.comparison);
        } else {
          // Build comparison from allocations with zero actuals if analysis doesn't return comparison
          const fallbackComparison: BudgetComparison[] = budgetData.allocations.map(
            (alloc) => ({
              category: alloc.category,
              budgeted: alloc.amount,
              actual: 0,
              variance: -alloc.amount,
              status: 'under' as const,
            })
          );
          setComparison(fallbackComparison);
        }
      } else {
        // If analysis fails, show allocations without actual spending
        const fallbackComparison: BudgetComparison[] = budgetData.allocations.map(
          (alloc) => ({
            category: alloc.category,
            budgeted: alloc.amount,
            actual: 0,
            variance: -alloc.amount,
            status: 'under' as const,
          })
        );
        setComparison(fallbackComparison);
      }
    } catch {
      // Graceful degradation
      const fallbackComparison: BudgetComparison[] = budgetData.allocations.map(
        (alloc) => ({
          category: alloc.category,
          budgeted: alloc.amount,
          actual: 0,
          variance: -alloc.amount,
          status: 'under' as const,
        })
      );
      setComparison(fallbackComparison);
    }
  };

  useEffect(() => {
    fetchBudget();
  }, [fetchBudget]);

  // Generate a new budget
  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setShortfall(null);
    setErrorReason(null);

    try {
      const res = await fetch('/api/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period_type: periodType }),
      });

      if (res.status === 422) {
        const data = await res.json();
        setShortfall(data.shortfall);
        setErrorReason(data.reason ?? 'shortfall');
        setError(data.error);
        setGenerating(false);
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate budget');
      }

      const budgetData: Budget = await res.json();
      setBudget(budgetData);
      await fetchComparison(budgetData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setGenerating(false);
    }
  };

  // Start editing an allocation
  const startEditing = (category: string, currentAmount: number) => {
    setEditingCategory(category);
    setEditAmount(currentAmount.toFixed(2));
  };

  // Save edited allocation
  const saveAllocation = async () => {
    if (!editingCategory) return;

    const newAmount = parseFloat(editAmount);
    if (isNaN(newAmount) || newAmount < 0) {
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/budget', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: editingCategory,
          amount: newAmount,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update allocation');
      }

      const updatedBudget: Budget = await res.json();
      setBudget(updatedBudget);
      await fetchComparison(updatedBudget);
      setEditingCategory(null);
      setEditAmount('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingCategory(null);
    setEditAmount('');
  };

  // --- Render ---

  if (loading) {
    return (
      <div className="px-4 py-4 sm:px-6 md:px-8">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <span className="ml-3 text-gray-600">Loading budget...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 sm:px-6 md:px-8 pb-24">

      {/* Period Selector */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setPeriodType('weekly')}
          className={`min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg font-medium transition-colors ${
            periodType === 'weekly'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Weekly
        </button>
        <button
          onClick={() => setPeriodType('monthly')}
          className={`min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg font-medium transition-colors ${
            periodType === 'monthly'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Monthly
        </button>
      </div>

      {/* Nothing to budget yet — a first-run state, not a failure */}
      {error && errorReason === 'no-income' && (
        <div
          className="mb-6 rounded-lg border border-violet-200 bg-violet-50 p-5"
          role="status"
        >
          <p className="font-semibold text-violet-900">
            Add your income first
          </p>
          <p className="mt-1 text-sm leading-6 text-violet-800">
            A budget divides up what you earn, so there is nothing to work with
            yet. Record your salary or any money coming in, and this page will
            build a plan around it.
          </p>
          <a
            href="/transactions"
            className="mt-4 inline-flex min-h-[44px] items-center rounded-xl bg-violet-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-violet-800"
          >
            Add your income
          </a>
        </div>
      )}

      {/* A real shortfall: income exists but is already committed */}
      {error && errorReason !== 'no-income' && (
        <div
          className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"
          role="alert"
        >
          <p className="font-medium">{error}</p>
          {shortfall !== null && shortfall > 0 && (
            <p className="mt-1 text-sm">
              Shortfall amount: <strong>{formatCurrency(shortfall)}</strong>
            </p>
          )}
        </div>
      )}

      {/* No Budget State — stays available so a failed attempt can be retried */}
      {!budget && errorReason !== 'no-income' && (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h2 className="mt-4 text-lg font-semibold text-gray-900">
            No budget for this period
          </h2>
          <p className="mt-2 text-gray-600 max-w-sm mx-auto">
            Create a budget to start tracking your spending against planned
            allocations.
          </p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="mt-6 min-h-[44px] min-w-[44px] px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generating ? 'Generating...' : `Generate ${periodType} budget`}
          </button>
        </div>
      )}

      {/* Budget Exists — Show allocations and comparison */}
      {budget && (
        <div className="space-y-6">
          {/* Budget Summary */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {budget.period_type === 'monthly' ? 'Monthly' : 'Weekly'} Budget
                </h2>
                <p className="text-sm text-gray-500">
                  {formatPeriod(budget.period_start, budget.period_end)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Total Income</p>
                <p className="text-xl font-bold text-gray-900">
                  {formatCurrency(budget.total_income)}
                </p>
              </div>
            </div>

            {/* Regenerate button */}
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="min-h-[44px] min-w-[44px] px-4 py-2 text-sm bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
            >
              {generating ? 'Regenerating...' : 'Regenerate Budget'}
            </button>
          </div>

          {/* Category Allocations */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Budget Allocations
            </h2>
            <div className="space-y-3">
              {budget.allocations.map((alloc) => (
                <div
                  key={alloc.category}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100"
                >
                  <div className="flex-1">
                    <span className="font-medium text-gray-900">
                      {alloc.category}
                    </span>
                    {alloc.is_fixed && (
                      <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                        Fixed
                      </span>
                    )}
                  </div>

                  {editingCategory === alloc.category ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        min="0"
                        step="0.01"
                        className="w-28 min-h-[44px] px-3 py-2 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        aria-label={`Edit amount for ${alloc.category}`}
                        autoFocus
                      />
                      <button
                        onClick={saveAllocation}
                        disabled={saving}
                        className="min-h-[44px] min-w-[44px] px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                        aria-label="Save"
                      >
                        ✓
                      </button>
                      <button
                        onClick={cancelEditing}
                        className="min-h-[44px] min-w-[44px] px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                        aria-label="Cancel"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEditing(alloc.category, alloc.amount)}
                      className="min-h-[44px] min-w-[44px] px-3 py-2 text-blue-700 font-semibold hover:bg-blue-50 rounded-lg transition-colors"
                      aria-label={`Edit ${alloc.category} allocation`}
                    >
                      {formatCurrency(alloc.amount)}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          {/* Planned vs Actual */}
          {comparison && comparison.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
              <h2 className="mb-1 text-lg font-semibold text-gray-900">
                Planned vs Actual
              </h2>
              <p className="mb-4 text-sm text-gray-500">
                Sorted by how far each category is from its plan.
              </p>
              <BudgetProgress rows={comparison} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
