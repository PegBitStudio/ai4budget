"use client";

import { useState, useEffect, useCallback } from "react";
import { formatCurrency } from "@/utils/formatters";
import ImportPanel from "@/components/transactions/ImportPanel";
import TransactionCard from "@/components/transactions/TransactionCard";
import { PageHeader } from "@/components/ui/primitives";

// --- Types ---

interface Transaction {
  id: string;
  amount: number;
  date: string;
  description: string;
  category: string;
  type: "income" | "expense";
}

interface TransactionsResponse {
  transactions: Transaction[];
  total: number;
}

const CATEGORIES = [
  "Housing",
  "Transport",
  "Groceries",
  "Utilities",
  "Entertainment",
  "Dining",
  "Health",
  "Shopping",
  "Subscriptions",
  "Other",
] as const;

// --- Main Component ---

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [category, setCategory] = useState("");

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await fetch("/api/transactions?limit=50");
      if (res.ok) {
        const data: TransactionsResponse = await res.json();
        setTransactions(data.transactions);
      }
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid amount greater than 0.");
      setSubmitting(false);
      return;
    }

    if (!description.trim()) {
      setError("Please enter a description.");
      setSubmitting(false);
      return;
    }

    try {
      const body: Record<string, unknown> = {
        amount: parsedAmount,
        description: description.trim(),
        type,
        date,
      };

      // Only include category if user explicitly selected one
      if (category) {
        body.category = category;
      }

      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to add transaction.");
      } else {
        setSuccess("Transaction added successfully.");
        setAmount("");
        setDescription("");
        setCategory("");
        setDate(new Date().toISOString().split("T")[0]);
        setShowForm(false);
        fetchTransactions();
      }
    } catch {
      setError("Unable to reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        description="Everything recorded, sorted automatically."
      />
      <ImportPanel onImported={fetchTransactions} />

      {/* Action bar */}
      <div className="flex items-center justify-between mb-4">
        {/* The empty state below already says there is nothing here. */}
        <p className="text-sm text-ink-500">
          {transactions.length > 0
            ? `${transactions.length} recent transaction${transactions.length === 1 ? "" : "s"}`
            : ""}
        </p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-ink-900 px-3.5 py-2 text-sm font-medium text-paper hover:bg-ink-900 transition-colors min-h-[44px]"
          aria-expanded={showForm}
          aria-controls="add-transaction-form"
        >
          {showForm ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
              Cancel
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
              </svg>
              Add
            </>
          )}
        </button>
      </div>

      {/* Feedback messages */}
      {error && (
        <div className="mb-4 rounded-lg border border-negative-100 bg-negative-50 p-3 text-sm text-negative-700" role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-lg border border-positive-100 bg-positive-50 p-3 text-sm text-positive-700" role="status">
          {success}
        </div>
      )}

      {/* Add transaction form */}
      {showForm && (
        <form
          id="add-transaction-form"
          onSubmit={handleSubmit}
          className="mb-6 rounded-lg border border-ink-200 bg-paper p-4 shadow-card space-y-4"
        >
          {/* Type toggle */}
          <div className="flex rounded-lg bg-ink-100 p-1">
            <button
              type="button"
              onClick={() => setType("expense")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors min-h-[40px] ${
                type === "expense"
                  ? "bg-paper text-negative-600 shadow-card"
                  : "text-ink-600 hover:text-ink-900"
              }`}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => setType("income")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors min-h-[40px] ${
                type === "income"
                  ? "bg-paper text-positive-600 shadow-card"
                  : "text-ink-600 hover:text-ink-900"
              }`}
            >
              Income
            </button>
          </div>

          {/* Amount */}
          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-ink-700 mb-1">
              Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 text-sm">₦</span>
              <input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
                className="w-full min-h-[44px] pl-7 pr-3 py-2 text-base border border-ink-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ink-700 focus:border-transparent"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-ink-700 mb-1">
              Description
            </label>
            <input
              id="description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Grocery shopping at Shoprite"
              required
              maxLength={255}
              className="w-full min-h-[44px] px-3 py-2 text-base border border-ink-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ink-700 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-ink-400">
              AI will auto-categorize based on description
            </p>
          </div>

          {/* Date */}
          <div>
            <label htmlFor="date" className="block text-sm font-medium text-ink-700 mb-1">
              Date
            </label>
            <input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
              required
              className="w-full min-h-[44px] px-3 py-2 text-base border border-ink-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ink-700 focus:border-transparent"
            />
          </div>

          {/* Category (optional override) */}
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-ink-700 mb-1">
              Category <span className="text-ink-400 font-normal">(optional)</span>
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 text-base border border-ink-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ink-700 focus:border-transparent bg-paper"
            >
              <option value="">Auto-detect from description</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[44px] rounded-lg bg-ink-900 px-4 py-2.5 text-sm font-medium text-paper hover:bg-ink-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Adding..." : `Add ${type === "income" ? "Income" : "Expense"}`}
          </button>
        </form>
      )}

      {/* Transactions list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-ink-100" />
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-14 h-14 rounded-full bg-ink-100 flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 text-ink-400">
              <path d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 9a.75.75 0 0 0-1.5 0v2.25H9a.75.75 0 0 0 0 1.5h2.25V15a.75.75 0 0 0 1.5 0v-2.25H15a.75.75 0 0 0 0-1.5h-2.25V9Z" />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-ink-900 mb-1">No transactions yet</h3>
          <p className="text-sm text-ink-500 mb-4">
            Tap the Add button above to record your first transaction.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {transactions.map((tx) => (
            <TransactionCard
              key={tx.id}
              transaction={tx}
              onChanged={fetchTransactions}
            />
          ))}
        </div>
      )}
    </div>
  );
}

