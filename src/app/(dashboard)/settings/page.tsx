'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatCurrency } from '@/utils/formatters';
import { CATEGORIES } from '@/models/category';
import AccountSection from '@/components/settings/AccountSection';
import AppearanceSection from '@/components/settings/AppearanceSection';
import { PageHeader } from "@/components/ui/primitives";

// --- Types ---

interface FinancialCommitment {
  id: string;
  user_id: string;
  description: string;
  amount: number;
  frequency: 'weekly' | 'fortnightly' | 'monthly' | 'yearly';
  category: string;
  created_at: string;
}

type Frequency = 'weekly' | 'fortnightly' | 'monthly' | 'yearly';

// --- Component ---

export default function SettingsPage() {
  // CSV Export state
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  // Data deletion state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);

  // Data transparency state
  const [showTransparency, setShowTransparency] = useState(false);

  // Commitments state
  const [commitments, setCommitments] = useState<FinancialCommitment[]>([]);
  const [loadingCommitments, setLoadingCommitments] = useState(true);
  const [commitmentsError, setCommitmentsError] = useState<string | null>(null);
  const [showCommitmentForm, setShowCommitmentForm] = useState(false);
  const [submittingCommitment, setSubmittingCommitment] = useState(false);
  const [deletingCommitmentId, setDeletingCommitmentId] = useState<string | null>(null);

  // Commitment form state
  const [commitDescription, setCommitDescription] = useState('');
  const [commitAmount, setCommitAmount] = useState('');
  const [commitFrequency, setCommitFrequency] = useState<Frequency>('monthly');
  const [commitCategory, setCommitCategory] = useState('Housing');
  const [commitFormError, setCommitFormError] = useState<string | null>(null);

  // --- CSV Export ---

  const handleExport = async () => {
    setExporting(true);
    setExportMessage(null);

    try {
      const res = await fetch('/api/csv/export');

      if (res.status === 404) {
        setExportMessage('No data to export');
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Export failed (${res.status})`);
      }

      // Trigger browser download
      const blob = await res.blob();
      const today = new Date().toISOString().split('T')[0];
      const filename = `budget_export_${today}.csv`;

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setExportMessage('Export downloaded successfully');
    } catch (err) {
      setExportMessage(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  // --- Data Deletion ---

  const handleDeleteAllData = async () => {
    setDeleting(true);
    setDeleteMessage(null);

    try {
      const res = await fetch('/api/transactions?all=true', {
        method: 'DELETE',
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Deletion failed (${res.status})`);
      }

      setDeleteMessage('All data has been deleted successfully.');
      setShowDeleteConfirm(false);
      setCommitments([]);
    } catch (err) {
      setDeleteMessage(err instanceof Error ? err.message : 'Deletion failed');
    } finally {
      setDeleting(false);
    }
  };

  // --- Commitments ---

  const fetchCommitments = useCallback(async () => {
    try {
      setLoadingCommitments(true);
      setCommitmentsError(null);
      const res = await fetch('/api/commitments');

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to load commitments (${res.status})`);
      }

      const json = await res.json();
      setCommitments(json.commitments ?? []);
    } catch (err) {
      setCommitmentsError(err instanceof Error ? err.message : 'Failed to load commitments');
    } finally {
      setLoadingCommitments(false);
    }
  }, []);

  useEffect(() => {
    fetchCommitments();
  }, [fetchCommitments]);

  const handleCreateCommitment = async (e: React.FormEvent) => {
    e.preventDefault();
    setCommitFormError(null);

    const amount = parseFloat(commitAmount);
    if (isNaN(amount) || amount < 0.01 || amount > 999999999.99) {
      setCommitFormError('Enter a valid amount between 0.01 and 999,999,999.99');
      return;
    }

    if (!commitDescription.trim() || commitDescription.length > 255) {
      setCommitFormError('Description must be between 1 and 255 characters');
      return;
    }

    try {
      setSubmittingCommitment(true);
      const res = await fetch('/api/commitments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: commitDescription.trim(),
          amount,
          frequency: commitFrequency,
          category: commitCategory,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to create commitment');
      }

      // Reset form and refresh
      setCommitDescription('');
      setCommitAmount('');
      setCommitFrequency('monthly');
      setCommitCategory('Housing');
      setShowCommitmentForm(false);
      await fetchCommitments();
    } catch (err) {
      setCommitFormError(err instanceof Error ? err.message : 'Failed to create commitment');
    } finally {
      setSubmittingCommitment(false);
    }
  };

  const handleDeleteCommitment = async (id: string) => {
    try {
      setDeletingCommitmentId(id);
      const res = await fetch(`/api/commitments?id=${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to delete commitment');
      }
      await fetchCommitments();
    } catch (err) {
      setCommitmentsError(err instanceof Error ? err.message : 'Failed to delete commitment');
    } finally {
      setDeletingCommitmentId(null);
    }
  };

  const frequencyLabel = (f: string) => {
    switch (f) {
      case 'weekly': return 'Weekly';
      case 'fortnightly': return 'Fortnightly';
      case 'monthly': return 'Monthly';
      case 'yearly': return 'Yearly';
      default: return f;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Your account, commitments and data."
      />

      <AccountSection />

      <AppearanceSection />

      {/* --- CSV Export Section --- */}
      <section className="bg-paper border border-ink-200 rounded-lg p-5 shadow-card">
        <h2 className="text-lg font-semibold text-ink-900 mb-2">Export Data</h2>
        <p className="text-sm text-ink-600 mb-4">
          Download all your transactions as a CSV file for backup or use in other tools.
        </p>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="min-h-[44px] min-w-[44px] px-5 py-3 bg-ink-900 text-paper rounded-lg font-medium hover:bg-ink-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {exporting ? 'Exporting...' : 'Export CSV'}
        </button>
        {exportMessage && (
          <p
            className={`mt-3 text-sm ${
              exportMessage.includes('successfully') ? 'text-positive-700' : 'text-warning-700'
            }`}
            role="status"
            aria-live="polite"
          >
            {exportMessage}
          </p>
        )}
      </section>

      {/* --- Data Transparency Panel --- */}
      <section className="bg-paper border border-ink-200 rounded-lg shadow-card overflow-hidden">
        <button
          onClick={() => setShowTransparency(!showTransparency)}
          className="w-full min-h-[44px] px-5 py-4 flex items-center justify-between text-left hover:bg-ink-50 transition-colors"
          aria-expanded={showTransparency}
          aria-controls="transparency-panel"
        >
          <span className="text-lg font-semibold text-ink-900">
            What data is sent to the AI?
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`w-5 h-5 text-ink-500 transition-transform duration-200 ${
              showTransparency ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {showTransparency && (
          <div id="transparency-panel" className="px-5 pb-5 space-y-4">
            <div className="border-t border-ink-100 pt-4">
              <h3 className="font-medium text-ink-800 mb-2">Data sent to the AI:</h3>
              <ul className="space-y-2 text-sm text-ink-700">
                <li className="flex items-start gap-2">
                  <span className="text-positive-600 font-bold mt-0.5">✓</span>
                  <span>
                    <strong>Transaction descriptions</strong> — used to classify your
                    expenses into categories (e.g. &quot;Woolworths&quot; → Groceries)
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-positive-600 font-bold mt-0.5">✓</span>
                  <span>
                    <strong>Aggregated totals</strong> — category totals and spending
                    summaries for generating plain-language overviews
                  </span>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-medium text-ink-800 mb-2">
                Data <span className="text-negative-600">NOT</span> sent to the AI:
              </h3>
              <ul className="space-y-2 text-sm text-ink-700">
                <li className="flex items-start gap-2">
                  <span className="text-negative-600 font-bold mt-0.5">✗</span>
                  <span>Account numbers or banking credentials</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-negative-600 font-bold mt-0.5">✗</span>
                  <span>Full transaction histories (only individual descriptions)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-negative-600 font-bold mt-0.5">✗</span>
                  <span>Personal information (name, address, phone, email)</span>
                </li>
              </ul>
            </div>

            <p className="text-xs text-ink-500 border-t border-ink-100 pt-3">
              All AI processing happens server-side. Your API keys are never exposed to
              the browser. Data is transmitted securely over HTTPS.
            </p>
          </div>
        )}
      </section>

      {/* --- Financial Commitments Section --- */}
      <section className="bg-paper border border-ink-200 rounded-lg p-5 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink-900">
            Financial Commitments
          </h2>
          <button
            onClick={() => setShowCommitmentForm(!showCommitmentForm)}
            className="min-h-[44px] min-w-[44px] px-4 py-2 bg-ink-900 text-paper rounded-lg font-medium hover:bg-ink-900 transition-colors text-sm"
            aria-expanded={showCommitmentForm}
            aria-controls="commitment-form"
          >
            {showCommitmentForm ? 'Cancel' : '+ Add'}
          </button>
        </div>

        {/* Add Commitment Form */}
        {showCommitmentForm && (
          <form
            id="commitment-form"
            onSubmit={handleCreateCommitment}
            className="border border-ink-200 rounded-lg p-4 mb-5 space-y-4 bg-ink-50"
          >
            <div>
              <label
                htmlFor="commit-description"
                className="block text-sm font-medium text-ink-700 mb-1"
              >
                Description *
              </label>
              <input
                id="commit-description"
                type="text"
                value={commitDescription}
                onChange={(e) => setCommitDescription(e.target.value)}
                placeholder="e.g. Rent, Netflix subscription"
                required
                maxLength={255}
                className="w-full min-h-[44px] px-3 py-2 border border-ink-300 rounded-md text-base focus:ring-2 focus:ring-ink-700 focus:border-ink-700 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="commit-amount"
                  className="block text-sm font-medium text-ink-700 mb-1"
                >
                  Amount *
                </label>
                <input
                  id="commit-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="999999999.99"
                  value={commitAmount}
                  onChange={(e) => setCommitAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full min-h-[44px] px-3 py-2 border border-ink-300 rounded-md text-base focus:ring-2 focus:ring-ink-700 focus:border-ink-700 outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="commit-frequency"
                  className="block text-sm font-medium text-ink-700 mb-1"
                >
                  Frequency *
                </label>
                <select
                  id="commit-frequency"
                  value={commitFrequency}
                  onChange={(e) => setCommitFrequency(e.target.value as Frequency)}
                  className="w-full min-h-[44px] px-3 py-2 border border-ink-300 rounded-md text-base focus:ring-2 focus:ring-ink-700 focus:border-ink-700 outline-none bg-paper"
                >
                  <option value="weekly">Weekly</option>
                  <option value="fortnightly">Fortnightly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="commit-category"
                className="block text-sm font-medium text-ink-700 mb-1"
              >
                Category *
              </label>
              <select
                id="commit-category"
                value={commitCategory}
                onChange={(e) => setCommitCategory(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 border border-ink-300 rounded-md text-base focus:ring-2 focus:ring-ink-700 focus:border-ink-700 outline-none bg-paper"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {commitFormError && (
              <p className="text-negative-600 text-sm" role="alert">
                {commitFormError}
              </p>
            )}

            <button
              type="submit"
              disabled={submittingCommitment}
              className="w-full min-h-[44px] px-4 py-3 bg-positive-600 text-paper rounded-lg font-medium hover:bg-positive-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submittingCommitment ? 'Adding...' : 'Add Commitment'}
            </button>
          </form>
        )}

        {/* Commitments List */}
        {loadingCommitments ? (
          <div className="animate-pulse space-y-3">
            <div className="h-16 bg-ink-100 rounded" />
            <div className="h-16 bg-ink-100 rounded" />
          </div>
        ) : commitmentsError ? (
          <div className="bg-negative-50 border border-negative-100 rounded-lg p-3">
            <p className="text-negative-700 text-sm">{commitmentsError}</p>
            <button
              onClick={fetchCommitments}
              className="mt-2 min-h-[44px] min-w-[44px] px-3 py-2 bg-negative-100 text-negative-700 rounded-md text-sm font-medium hover:bg-negative-100 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : commitments.length === 0 ? (
          <p className="text-ink-500 text-sm text-center py-4">
            No financial commitments yet. Add recurring bills and subscriptions.
          </p>
        ) : (
          <ul className="space-y-3">
            {commitments.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 border border-ink-100 rounded-lg p-3 hover:bg-ink-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink-900 truncate">
                    {c.description}
                  </p>
                  <p className="text-xs text-ink-500 mt-0.5">
                    {formatCurrency(c.amount)} · {frequencyLabel(c.frequency)} ·{' '}
                    <span className="inline-block bg-ink-100 px-1.5 py-0.5 rounded text-xs">
                      {c.category}
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteCommitment(c.id)}
                  disabled={deletingCommitmentId === c.id}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-negative-600 hover:text-negative-700 hover:bg-negative-50 rounded-md transition-colors disabled:opacity-50"
                  aria-label={`Delete commitment: ${c.description}`}
                >
                  {deletingCommitmentId === c.id ? (
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
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* --- Danger Zone: Delete All Data --- */}
      <section className="bg-paper border border-negative-100 rounded-lg p-5 shadow-card">
        <h2 className="text-lg font-semibold text-negative-700 mb-2">Danger Zone</h2>
        <p className="text-sm text-ink-600 mb-4">
          Permanently delete all your financial data, including transactions, budgets,
          savings goals, commitments, alerts, and classification rules. This action
          cannot be undone.
        </p>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="min-h-[44px] min-w-[44px] px-5 py-3 bg-negative-600 text-paper rounded-lg font-medium hover:bg-negative-700 transition-colors"
          >
            Delete All Data
          </button>
        ) : (
          <div className="bg-negative-50 border border-negative-100 rounded-lg p-4 space-y-3">
            <p className="text-negative-700 font-medium text-sm">
              Are you sure? This will permanently delete ALL your data.
            </p>
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={handleDeleteAllData}
                disabled={deleting}
                className="min-h-[44px] min-w-[44px] px-5 py-3 bg-negative-700 text-paper rounded-lg font-medium hover:bg-negative-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete Everything'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="min-h-[44px] min-w-[44px] px-5 py-3 bg-paper text-ink-700 border border-ink-300 rounded-lg font-medium hover:bg-ink-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {deleteMessage && (
          <p
            className={`mt-3 text-sm ${
              deleteMessage.includes('successfully') ? 'text-positive-700' : 'text-negative-700'
            }`}
            role="status"
            aria-live="polite"
          >
            {deleteMessage}
          </p>
        )}
      </section>
    </div>
  );
}
