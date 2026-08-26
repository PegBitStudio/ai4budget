"use client";

import { useEffect, useRef, useState } from "react";
import { formatCurrency } from "@/utils/formatters";
import { CATEGORIES, Category } from "@/models/category";
import { categoryColor } from "@/config/categories";
import { Button, Badge, cx } from "@/components/ui/primitives";
import type { Transaction } from "@/models/transaction";

/**
 * A transaction opened in place.
 *
 * A panel rather than a route change, because editing one row should not cost
 * you your scroll position, your filters or your place in the list — you are
 * correcting a detail, not going somewhere.
 *
 * Correcting the category also teaches the classifier, and the panel says so
 * before you save rather than after.
 */
export default function TransactionDrawer({
  transaction,
  onClose,
  onChanged,
}: {
  transaction: Transaction | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Reset the form whenever a different row is opened.
  useEffect(() => {
    if (!transaction) return;
    setDescription(transaction.description);
    setAmount(String(transaction.amount));
    setDate(transaction.date);
    setCategory(transaction.category);
    setError(null);
    setConfirmingDelete(false);
  }, [transaction]);

  // Escape closes, and focus moves into the panel so a keyboard user is not
  // left behind in the table. The page behind is frozen for the same reason —
  // a scroll aimed at the panel should not move the list underneath it.
  useEffect(() => {
    if (!transaction) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [transaction, onClose]);

  if (!transaction) return null;

  const isIncome = transaction.type === "income";
  const categoryChanged = category !== transaction.category;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!transaction) return;
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
    if (date > localToday()) {
      setError("Pick a date that is not in the future.");
      return;
    }

    // Send only what actually changed.
    const patch: Record<string, unknown> = {};
    if (description.trim() !== transaction.description) patch.description = description.trim();
    if (parsedAmount !== transaction.amount) patch.amount = parsedAmount;
    if (date !== transaction.date) patch.date = date;
    if (categoryChanged) patch.category = category;

    if (Object.keys(patch).length === 0) {
      onClose();
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
      onChanged();
      onClose();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!transaction) return;
    setBusy(true);
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
      onClose();
    } catch {
      setError("Could not reach the server. Please try again.");
      setConfirmingDelete(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Transaction detail"
    >
      <div
        className="animate-fade absolute inset-0 bg-[rgba(6,8,9,0.45)] backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        tabIndex={-1}
        className="animate-slide-in relative flex h-full w-full max-w-md flex-col bg-paper shadow-overlay outline-none"
      >
        <header className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4">
          <div className="min-w-0">
            <p className="text-eyebrow uppercase text-ink-500">
              {isIncome ? "Money in" : "Money out"}
            </p>
            <p
              className={cx(
                "mt-1 text-figure tnum",
                isIncome ? "text-positive-700" : "text-ink-950"
              )}
            >
              {isIncome ? "+" : "−"}
              {formatCurrency(transaction.amount)}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid size-9 shrink-0 place-items-center rounded-md text-ink-500 transition-colors duration-[--duration-fast] hover:bg-ink-100 hover:text-ink-900"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" className="size-5" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <form onSubmit={save} noValidate className="flex-1 overflow-y-auto px-5 py-4">
          {error && (
            <p role="alert" className="mb-4 rounded-md bg-negative-50 p-3 text-body text-negative-700">
              {error}
            </p>
          )}

          <Field label="Description" id="d-desc">
            <input
              id="d-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass}
            />
          </Field>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Amount" id="d-amount">
              <input
                id="d-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={cx(inputClass, "tnum")}
              />
            </Field>
            <Field label="Date" id="d-date">
              <input
                id="d-date"
                type="date"
                value={date}
                max={localToday()}
                onChange={(e) => setDate(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          {!isIncome && (
            <div className="mt-4">
              <Field label="Category" id="d-cat">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: categoryColor(category) }}
                  />
                  <select
                    id="d-cat"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as Category)}
                    className={cx(inputClass, "bg-paper")}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </Field>

              {categoryChanged && (
                <p className="animate-fade mt-2 rounded-md bg-jade-50 p-2.5 text-label text-jade-700">
                  Future transactions for “{transaction.description}” will be
                  filed under {category}.
                </p>
              )}

              {!transaction.is_manual_category && (
                <p className="mt-2 flex items-center gap-1.5 text-label text-ink-500">
                  <Badge tone="ai">AI</Badge>
                  Chosen by the assistant. Correcting it teaches the classifier.
                </p>
              )}
            </div>
          )}
        </form>

        <footer className="flex flex-wrap items-center gap-2 border-t border-ink-100 px-5 py-4">
          <Button variant="primary" onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <button
            onClick={() => setConfirmingDelete(true)}
            className="ml-auto rounded-md px-3 py-2 text-label font-medium text-negative-600 transition-colors duration-[--duration-fast] hover:bg-negative-50"
          >
            Delete
          </button>
        </footer>

        {confirmingDelete && (
          <div className="animate-fade border-t border-negative-100 bg-negative-50 px-5 py-4">
            <p className="text-body text-negative-700">
              Delete “{transaction.description}”? This cannot be undone.
            </p>
            <div className="mt-3 flex gap-2">
              <Button variant="danger" size="sm" onClick={remove} disabled={busy}>
                {busy ? "Deleting…" : "Yes, delete it"}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setConfirmingDelete(false)}>
                Keep it
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const inputClass =
  "min-h-10 w-full rounded-md border border-ink-200 px-3 text-body text-ink-900 transition-colors duration-[--duration-fast] focus:border-ink-900 focus:outline-none";

function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-label font-medium text-ink-700">
        {label}
      </label>
      {children}
    </div>
  );
}

function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
