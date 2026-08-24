'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatCurrency } from '@/utils/formatters';

// --- Types ---

interface SavingsGoal {
  id: string;
  user_id: string;
  target_amount: number;
  deadline?: string | null;
  current_amount: number;
  monthly_contribution: number;
  created_at: string;
}

interface SavingsRecommendation {
  monthlyContribution: number;
  isExcessive: boolean;
  alternatives?: {
    longerTimeline?: { months: number; monthlyAmount: number };
    reducedGoal?: { amount: number; monthlyAmount: number };
  };
  explanation: string;
  hasGoal: boolean;
}

interface SavingsData {
  goals: SavingsGoal[];
  recommendation: SavingsRecommendation;
}

// --- Component ---

export default function SavingsPage() {
  const [data, setData] = useState<SavingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [targetAmount, setTargetAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const fetchSavings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/savings');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to load savings data (${res.status})`);
      }
      const json: SavingsData = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSavings();
  }, [fetchSavings]);

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const amount = parseFloat(targetAmount);
    if (isNaN(amount) || amount < 0.01 || amount > 999999999.99) {
      setFormError('Enter a valid target amount between 0.01 and 999,999,999.99');
      return;
    }

    const payload: { target_amount: number; deadline?: string } = {
      target_amount: amount,
    };

    if (deadline) {
      const deadlineDate = new Date(deadline + 'T00:00:00');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (deadlineDate <= today) {
        setFormError('Deadline must be in the future');
        return;
      }
      payload.deadline = deadline;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/savings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to create savings goal');
      }

      // Reset form and refresh data
      setTargetAmount('');
      setDeadline('');
      setShowForm(false);
      await fetchSavings();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create goal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteGoal = async (id: string) => {
    try {
      setDeletingId(id);
      const res = await fetch(`/api/savings?id=${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to delete goal');
      }
      await fetchSavings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete goal');
    } finally {
      setDeletingId(null);
    }
  };

  // --- Loading State ---
  if (loading) {
    return (
      <div className="px-4 py-6 sm:px-6 md:px-8 lg:px-12 max-w-3xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-24 bg-gray-200 rounded" />
          <div className="h-24 bg-gray-200 rounded" />
          <div className="h-8 bg-gray-200 rounded w-56" />
          <div className="h-32 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  // --- Error State ---
  if (error && !data) {
    return (
      <div className="px-4 py-6 sm:px-6 md:px-8 lg:px-12 max-w-3xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 font-medium">Error loading savings data</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          <button
            onClick={fetchSavings}
            className="mt-3 min-h-[44px] min-w-[44px] px-4 py-2 bg-red-100 text-red-700 rounded-md font-medium hover:bg-red-200 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const goals = data?.goals ?? [];
  const recommendation = data?.recommendation;

  return (
    <div className="px-4 py-6 sm:px-6 md:px-8 lg:px-12 max-w-3xl mx-auto space-y-8">
      {/* Inline error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* --- Your Savings Goals Section --- */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
            Your Savings Goals
          </h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="min-h-[44px] min-w-[44px] px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm"
            aria-expanded={showForm}
            aria-controls="add-goal-form"
          >
            {showForm ? 'Cancel' : '+ Add Goal'}
          </button>
        </div>

        {/* --- Add Goal Form (Collapsible) --- */}
        {showForm && (
          <form
            id="add-goal-form"
            onSubmit={handleCreateGoal}
            className="bg-white border border-gray-200 rounded-lg p-4 mb-6 space-y-4 shadow-sm"
          >
            <h2 className="text-lg font-semibold text-gray-800">
              New Savings Goal
            </h2>

            <div>
              <label
                htmlFor="target-amount"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Target Amount *
              </label>
              <input
                id="target-amount"
                type="number"
                step="0.01"
                min="0.01"
                max="999999999.99"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder="e.g. 500000"
                required
                className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-md text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="deadline"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Deadline (optional)
              </label>
              <input
                id="deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                min={getTomorrowDate()}
                className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-md text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            {formError && (
              <p className="text-red-600 text-sm" role="alert">
                {formError}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[44px] px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Creating...' : 'Create Goal'}
            </button>
          </form>
        )}

        {/* --- Goals List --- */}
        {goals.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
            <p className="text-gray-600">
              No savings goals yet. Add one to get started!
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {goals.map((goal) => {
              const progress =
                goal.target_amount > 0
                  ? Math.min(
                      100,
                      (goal.current_amount / goal.target_amount) * 100
                    )
                  : 0;

              return (
                <li
                  key={goal.id}
                  className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-lg font-semibold text-gray-900">
                        {formatCurrency(goal.target_amount)}
                      </p>
                      {goal.deadline && (
                        <p className="text-sm text-gray-500 mt-0.5">
                          Deadline:{' '}
                          {new Date(goal.deadline + 'T00:00:00').toLocaleDateString(
                            undefined,
                            { year: 'numeric', month: 'short', day: 'numeric' }
                          )}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteGoal(goal.id)}
                      disabled={deletingId === goal.id}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                      aria-label={`Delete savings goal of ${formatCurrency(goal.target_amount)}`}
                    >
                      {deletingId === goal.id ? (
                        <span className="text-xs">...</span>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="w-5 h-5"
                          aria-hidden="true"
                        >
                          <path
                            fillRule="evenodd"
                            d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>
                        {formatCurrency(goal.current_amount)} saved
                      </span>
                      <span>{progress.toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-300"
                        style={{ width: `${progress}%` }}
                        role="progressbar"
                        aria-valuenow={goal.current_amount}
                        aria-valuemin={0}
                        aria-valuemax={goal.target_amount}
                        aria-label={`${progress.toFixed(1)}% of ${formatCurrency(goal.target_amount)} saved`}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* --- Recommendations Section --- */}
      {recommendation && (
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-4 sm:text-2xl">
            Recommendations
          </h2>

          <div className="bg-gradient-to-br from-blue-50 to-green-50 border border-blue-100 rounded-lg p-5 shadow-sm">
            {/* Main recommendation text */}
            <p className="text-gray-800 leading-relaxed">
              {recommendation.explanation}
            </p>

            {/* Monthly contribution highlight */}
            <div className="mt-4 flex items-center gap-2">
              <span className="text-sm font-medium text-gray-600">
                Suggested monthly:
              </span>
              <span className="text-lg font-bold text-blue-700">
                {formatCurrency(recommendation.monthlyContribution)}
              </span>
            </div>

            {/* Alternatives when recommendation is excessive */}
            {recommendation.isExcessive && recommendation.alternatives && (
              <div className="mt-5 border-t border-blue-200 pt-4">
                <p className="text-sm font-semibold text-amber-700 mb-3">
                  ⚠️ This exceeds 30% of your discretionary income. Consider
                  these alternatives:
                </p>
                <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                  {recommendation.alternatives.longerTimeline && (
                    <li>
                      <span className="font-medium">Extend your timeline</span>{' '}
                      to {recommendation.alternatives.longerTimeline.months}{' '}
                      months, contributing{' '}
                      {formatCurrency(
                        recommendation.alternatives.longerTimeline.monthlyAmount
                      )}
                      /month
                    </li>
                  )}
                  {recommendation.alternatives.reducedGoal && (
                    <li>
                      <span className="font-medium">Reduce your target</span> to{' '}
                      {formatCurrency(
                        recommendation.alternatives.reducedGoal.amount
                      )}
                      , saving{' '}
                      {formatCurrency(
                        recommendation.alternatives.reducedGoal.monthlyAmount
                      )}
                      /month
                    </li>
                  )}
                </ol>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

// --- Helpers ---

function getTomorrowDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const day = String(tomorrow.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
