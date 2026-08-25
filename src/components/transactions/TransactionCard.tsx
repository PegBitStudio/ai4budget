"use client";

import { useState } from "react";
import { formatCurrency } from "@/utils/formatters";
import { CATEGORIES, Category } from "@/models/category";

export interface Transaction {
  id: string;
  amount: number;
  date: string;
  description: string;
  category: string;
  type: "income" | "expense";
  is_manual_category?: boolean;
}

/**
 * A transaction in the list, expandable into an editor.
 *
 * Correcting the category here also teaches the classifier, so the same
 * merchant is filed correctly next time without being asked again.
 */
export default function TransactionCard({
  transaction,
  onChanged,
}: {
  transaction: Transaction;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [description, setDescription] = useState(transaction.description);
  const [amount, setAmount] = useState(String(transaction.amount));
  const [date, setDate] = useState(transaction.date);
  const [category, setCategory] = useState(transaction.category);

  const isIncome = transaction.type === "income";

  function cancel() {
    setDescription(transaction.description);
    setAmount(String(transaction.amount));
    setDate(transaction.date);
    setCategory(transaction.category);
    setError(null);
    setEditing(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (!description.trim()) {
      setError("Enter a description.");
      return;
    }
    // Validated here rather than left to the input's `max`, which blocks the
    // submit silently and leaves the user with no idea why nothing happened.
    if (date > localToday()) {
      setError("Pick a date that is not in the future.");
      return;
    }

    // Send only what actually changed.
    const patch: Record<string, unknown> = {};
    if (description.trim() !== transaction.description) {
      patch.description = description.trim();
    }
    if (parsedAmount !== transaction.amount) patch.amount = parsedAmount;
    if (date !== transaction.date) patch.date = date;
    if (category !== transaction.category) patch.category = category;

    if (Object.keys(patch).length === 0) {
      setEditing(false);
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/transactions/${transaction.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not save that change.");
        return;
      }

      setEditing(false);
      onChanged();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/transactions/${transaction.id}`, {
        method: "DELETE",
      });

      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not delete that transaction.");
        setConfirmingDelete(false);
        return;
      }

      onChanged();
    } catch {
      setError("Could not reach the server. Please try again.");
      setConfirmingDelete(false);
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <form
        onSubmit={save}
        noValidate
        className="rounded-xl border border-violet-200 bg-white p-4 shadow-sm"
      >
        {error && (
          <p
            role="alert"
            className="mb-3 rounded-lg bg-rose-50 p-2.5 text-sm text-rose-700"
          >
            {error}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label
              htmlFor={`desc-${transaction.id}`}
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Description
            </label>
            <input
              id={`desc-${transaction.id}`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[44px] w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>

          <div>
            <label
              htmlFor={`amount-${transaction.id}`}
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Amount
            </label>
            <input
              id={`amount-${transaction.id}`}
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="min-h-[44px] w-full rounded-lg border border-slate-300 px-3 py-2 tabular-nums focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>

          <div>
            <label
              htmlFor={`date-${transaction.id}`}
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Date
            </label>
            <input
              id={`date-${transaction.id}`}
              type="date"
              value={date}
              max={localToday()}
              onChange={(e) => setDate(e.target.value)}
              className="min-h-[44px] w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>

          {!isIncome && (
            <div className="sm:col-span-2">
              <label
                htmlFor={`cat-${transaction.id}`}
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Category
              </label>
              <select
                id={`cat-${transaction.id}`}
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {category !== transaction.category && (
                <p className="mt-1.5 text-xs text-violet-700">
                  Future transactions for “{transaction.description}” will be
                  filed under {category}.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={busy}
            className="min-h-[44px] rounded-lg bg-violet-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-violet-800 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            onClick={cancel}
            className="min-h-[44px] rounded-lg px-4 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="ml-auto min-h-[44px] rounded-lg px-4 text-sm font-medium text-rose-700 hover:bg-rose-50"
          >
            Delete
          </button>
        </div>

        {confirmingDelete && (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3">
            <p className="text-sm text-rose-900">
              Delete “{transaction.description}”? This cannot be undone.
            </p>
            <div className="mt-2.5 flex gap-2">
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                className="min-h-[44px] rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {busy ? "Deleting…" : "Yes, delete it"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="min-h-[44px] rounded-lg px-4 text-sm font-medium text-slate-600 hover:bg-white"
              >
                Keep it
              </button>
            </div>
          </div>
        )}
      </form>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-white p-3.5 text-left shadow-sm transition-colors hover:border-violet-200 hover:bg-violet-50/40"
      aria-label={`Edit ${transaction.description}`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
          isIncome ? "bg-green-50" : "bg-red-50"
        }`}
      >
        <span className="text-lg" aria-hidden="true">
          {isIncome ? "↗" : "↘"}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">
          {transaction.description}
        </p>
        <p className="flex items-center gap-1.5 text-xs text-gray-500">
          <span>{transaction.category}</span>
          <span aria-hidden="true">·</span>
          <span>{formatDate(transaction.date)}</span>
          {!isIncome && !transaction.is_manual_category && (
            <span
              className="rounded bg-violet-100 px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700"
              title="Category chosen by the assistant — tap to correct it"
            >
              AI
            </span>
          )}
        </p>
      </div>

      <p
        className={`shrink-0 text-sm font-semibold tabular-nums ${
          isIncome ? "text-green-600" : "text-red-600"
        }`}
      >
        {isIncome ? "+" : "-"}
        {formatCurrency(transaction.amount)}
      </p>
    </button>
  );
}

// --- Helpers ---

function formatDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
