'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { formatCurrency } from '@/utils/formatters';
import BudgetProgress from '@/components/budget/BudgetProgress';
import BudgetForecast from '@/components/budget/BudgetForecast';
import { PageHeader } from "@/components/ui/primitives";
import { parseBudgetCSV, generateBudgetTemplateCSV } from '@/lib/csvService';

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
  /** Income minus commitments and savings — what allocations are actually
      divided from. Computed on read, not stored, so it stays correct even
      after commitments or savings goals change. */
  availableIncome?: number;
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
      return 'text-positive-700 bg-positive-50 border-positive-100';
    case 'on-track':
      return 'text-warning-700 bg-warning-50 border-warning-100';
    case 'over':
      return 'text-negative-700 bg-negative-50 border-negative-100';
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

  // Starting a budget by hand — from scratch, or from an uploaded template —
  // rather than from logged transactions.
  const [startMode, setStartMode] = useState<'auto' | 'manual' | 'upload'>('auto');
  const [manualBusy, setManualBusy] = useState(false);
  const [csvErrors, setCsvErrors] = useState<string[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Create a budget by hand — no income transaction required. Shared by
  // "start from scratch" (no allocations, every category lands on 0 and is
  // edited from there) and the CSV upload (allocations already parsed).
  const createManualBudget = async (
    allocations: { category: string; amount: number }[]
  ) => {
    setManualBusy(true);
    setError(null);
    setShortfall(null);
    setErrorReason(null);
    setCsvErrors(null);

    try {
      const res = await fetch('/api/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period_type: periodType, mode: 'manual', allocations }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create budget');
      }

      const budgetData: Budget = await res.json();
      setBudget(budgetData);
      await fetchComparison(budgetData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setManualBusy(false);
    }
  };

  const handleStartBlank = () => createManualBudget([]);

  const handleDownloadTemplate = () => {
    const blob = new Blob([generateBudgetTemplateCSV()], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'budget-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleUploadCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setCsvErrors(null);

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const { allocations, errors } = parseBudgetCSV(text);

      if (allocations.length === 0) {
        setCsvErrors(
          errors.length > 0
            ? errors.map((err) => `Row ${err.row}: ${err.message}`)
            : ['The file has no usable rows.']
        );
        return;
      }

      // Partial errors don't block the rows that did parse — the person can
      // fix the file and re-upload for the rest, same as transaction import.
      if (errors.length > 0) {
        setCsvErrors(errors.map((err) => `Row ${err.row}: ${err.message}`));
      }

      createManualBudget(allocations);
    };
    reader.readAsText(file);
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
          period_type: periodType,
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ink-900" />
          <span className="ml-3 text-ink-600">Loading budget...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Budget"
        description="What you planned against what you actually spent."
      />

      {/* Period Selector */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setPeriodType('weekly')}
          className={`min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg font-medium transition-colors ${
            periodType === 'weekly'
              ? 'bg-ink-900 text-paper'
              : 'bg-ink-100 text-ink-700 hover:bg-ink-200'
          }`}
        >
          Weekly
        </button>
        <button
          onClick={() => setPeriodType('monthly')}
          className={`min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg font-medium transition-colors ${
            periodType === 'monthly'
              ? 'bg-ink-900 text-paper'
              : 'bg-ink-100 text-ink-700 hover:bg-ink-200'
          }`}
        >
          Monthly
        </button>
      </div>

      {/* A real shortfall: income exists but is already committed */}
      {error && errorReason === 'shortfall' && (
        <div
          className="mb-6 rounded-lg border border-negative-100 bg-negative-50 p-4 text-negative-700"
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
      {!budget && (
        <div className="rounded-lg border border-ink-200 bg-ink-50 p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-ink-900">
            No budget for this period
          </h2>
          <p className="mt-2 max-w-md text-ink-600">
            A budget from your spending history is one option — building your
            own from a blank slate, or from a spreadsheet, is another. Neither
            needs a transaction logged first.
          </p>

          <div className="mt-5 max-w-xs">
            <label
              htmlFor="start-mode"
              className="mb-1.5 block text-sm font-medium text-ink-700"
            >
              How do you want to build this budget?
            </label>
            <select
              id="start-mode"
              value={startMode}
              onChange={(e) => {
                setStartMode(e.target.value as typeof startMode);
                setCsvErrors(null);
              }}
              className="min-h-[44px] w-full rounded-lg border border-ink-300 bg-paper px-3 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-ink-700"
            >
              <option value="auto">From my transactions</option>
              <option value="manual">Start from scratch</option>
              <option value="upload">Upload a spreadsheet</option>
            </select>
          </div>

          {startMode === 'auto' && (
            <div className="mt-5">
              {errorReason === 'no-income' && (
                <p className="mb-3 max-w-md text-sm leading-6 text-ink-600">
                  There is no spending history to build this from yet — log a
                  transaction first, or switch to &ldquo;Start from
                  scratch&rdquo; above.
                </p>
              )}
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="min-h-[44px] px-6 py-3 bg-ink-900 text-paper font-medium rounded-lg hover:bg-ink-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {generating ? 'Generating...' : `Generate ${periodType} budget`}
              </button>
            </div>
          )}

          {startMode === 'manual' && (
            <div className="mt-5">
              <p className="mb-3 max-w-md text-sm leading-6 text-ink-600">
                Every category starts at ₦0. Set each one to whatever fits
                your life — free transport, an HMO that covers Health, or
                anything else the defaults don&apos;t know about.
              </p>
              <button
                onClick={handleStartBlank}
                disabled={manualBusy}
                className="min-h-[44px] px-6 py-3 bg-ink-900 text-paper font-medium rounded-lg hover:bg-ink-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {manualBusy ? 'Creating...' : 'Start from scratch'}
              </button>
            </div>
          )}

          {startMode === 'upload' && (
            <div className="mt-5">
              <p className="mb-3 max-w-md text-sm leading-6 text-ink-600">
                Download the template, fill in an amount for each category in
                Excel or Sheets, and upload it back.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="min-h-[44px] rounded-lg border border-ink-300 bg-paper px-5 text-sm font-medium text-ink-800 transition-colors hover:bg-ink-100"
                >
                  Download template
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={manualBusy}
                  className="min-h-[44px] rounded-lg bg-ink-900 px-5 text-sm font-medium text-paper transition-colors hover:bg-ink-800 disabled:opacity-50"
                >
                  {manualBusy ? 'Uploading...' : 'Upload your filled-in template'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleUploadCSV}
                  className="hidden"
                  aria-label="Upload budget spreadsheet"
                />
              </div>
              {csvErrors && csvErrors.length > 0 && (
                <div className="mt-3 rounded-lg border border-warning-100 bg-warning-50 p-3 text-sm text-warning-700">
                  <p className="font-medium">
                    {csvErrors.length === 1
                      ? 'One row could not be used:'
                      : `${csvErrors.length} rows could not be used:`}
                  </p>
                  <ul className="mt-1 list-disc pl-5">
                    {csvErrors.map((msg, i) => (
                      <li key={i}>{msg}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Budget Exists — Show allocations and comparison */}
      {budget && (
        <div className="space-y-6">
          {/* Budget Summary */}
          <div className="bg-paper border border-ink-200 rounded-lg p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-ink-900">
                  {budget.period_type === 'monthly' ? 'Monthly' : 'Weekly'} Budget
                </h2>
                <p className="text-sm text-ink-500">
                  {formatPeriod(budget.period_start, budget.period_end)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-ink-500">Total Income</p>
                <p className="text-xl font-bold text-ink-900">
                  {formatCurrency(budget.total_income)}
                </p>
              </div>
            </div>

            {/* Regenerate button */}
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="min-h-[44px] min-w-[44px] px-4 py-2 text-sm bg-ink-100 text-ink-700 font-medium rounded-lg hover:bg-ink-200 disabled:opacity-50 transition-colors"
            >
              {generating ? 'Regenerating...' : 'Regenerate Budget'}
            </button>
          </div>

          {/* Category Allocations */}
          <div className="bg-paper border border-ink-200 rounded-lg p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="text-lg font-semibold text-ink-900">
                Budget Allocations
              </h2>
              {/* Editing a category changes only that category — nothing else
                  moves. This is what shows whether the total still adds up,
                  since nothing does that silently anymore. */}
              {(() => {
                const target = budget.availableIncome ?? budget.total_income;
                const allocated = budget.allocations.reduce((sum, a) => sum + a.amount, 0);
                const remaining = target - allocated;
                // A genuinely blank budget has no target yet — commitments
                // and savings still subtract from a income of ₦0, which
                // would otherwise show as a nonsensical negative figure.
                if (target <= 0) {
                  return (
                    <p className="text-sm text-ink-600">
                      Allocated{" "}
                      <span className="font-semibold tabular-nums text-ink-900">
                        {formatCurrency(allocated)}
                      </span>
                    </p>
                  );
                }
                return (
                  <p className="text-sm text-ink-600">
                    Allocated{" "}
                    <span className="font-semibold tabular-nums text-ink-900">
                      {formatCurrency(allocated)}
                    </span>{" "}
                    of {formatCurrency(target)}
                    {Math.abs(remaining) > 0.01 && (
                      <span
                        className={
                          remaining > 0
                            ? "ml-1 font-medium text-ink-500"
                            : "ml-1 font-medium text-negative-700"
                        }
                      >
                        {remaining > 0
                          ? `— ${formatCurrency(remaining)} unallocated`
                          : `— ${formatCurrency(Math.abs(remaining))} over`}
                      </span>
                    )}
                  </p>
                );
              })()}
            </div>
            <div className="space-y-3">
              {budget.allocations.map((alloc) => (
                <div
                  key={alloc.category}
                  className="flex items-center justify-between p-3 bg-ink-50 rounded-lg border border-ink-100"
                >
                  <div className="flex-1">
                    <span className="font-medium text-ink-900">
                      {alloc.category}
                    </span>
                    {alloc.is_fixed && (
                      <span className="ml-2 text-xs bg-ink-200 text-ink-600 px-2 py-0.5 rounded">
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
                        className="w-28 min-h-[44px] px-3 py-2 text-base border border-ink-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ink-700"
                        aria-label={`Edit amount for ${alloc.category}`}
                        autoFocus
                      />
                      <button
                        onClick={saveAllocation}
                        disabled={saving}
                        className="min-h-[44px] min-w-[44px] px-3 py-2 bg-positive-600 text-paper rounded-lg hover:bg-positive-700 disabled:opacity-50 transition-colors"
                        aria-label="Save"
                      >
                        ✓
                      </button>
                      <button
                        onClick={cancelEditing}
                        className="min-h-[44px] min-w-[44px] px-3 py-2 bg-ink-200 text-ink-700 rounded-lg hover:bg-ink-300 transition-colors"
                        aria-label="Cancel"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEditing(alloc.category, alloc.amount)}
                      className="min-h-[44px] min-w-[44px] px-3 py-2 text-ink-900 font-semibold hover:bg-ink-50 rounded-lg transition-colors"
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
            <div className="rounded-lg border border-ink-200 bg-paper p-4 sm:p-6">
              <h2 className="mb-1 text-lg font-semibold text-ink-900">
                Planned vs Actual
              </h2>
              <p className="mb-4 text-sm text-ink-500">
                Sorted by how far each category is from its plan.
              </p>
              <BudgetProgress rows={comparison} />
              <div className="mt-6">
                <BudgetForecast />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
