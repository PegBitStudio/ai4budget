"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import ImportPanel from "@/components/transactions/ImportPanel";
import TransactionTable, { SortKey } from "@/components/transactions/TransactionTable";
import TransactionDrawer from "@/components/transactions/TransactionDrawer";
import TransactionFilters, {
  Filters,
  EMPTY_FILTERS,
} from "@/components/transactions/TransactionFilters";
import type { Transaction } from "@/models/transaction";
import {
  Card,
  Button,
  PageHeader,
  EmptyState,
  cx,
} from "@/components/ui/primitives";

const PAGE_SIZE = 25;

/**
 * The ledger page.
 *
 * Filtering, sorting and paging all happen on the server: the table shows one
 * page of a possibly long history, so sorting only the 25 rows in hand would
 * quietly sort the wrong set. Every control below writes into the same query
 * string, and one effect turns that into one request.
 */
export default function TransactionsPage() {
  const [rows, setRows] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("date");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);

  const [selected, setSelected] = useState<Transaction | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Typing should not fire a request per keystroke.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(filters.search), 250);
    return () => clearTimeout(id);
  }, [filters.search]);

  // Any change to what is being asked for sends you back to the first page —
  // page 3 of a different result set is a different, meaningless page.
  useEffect(() => {
    setPage(0);
  }, [
    debouncedSearch,
    filters.category,
    filters.type,
    filters.from,
    filters.to,
    sort,
    dir,
  ]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
      sort,
      dir,
    });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (filters.category) params.set("category", filters.category);
    if (filters.type) params.set("type", filters.type);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);

    try {
      const res = await fetch(`/api/transactions?${params}`);
      if (!res.ok) {
        setLoadError("Could not load your transactions.");
        return;
      }
      const data = await res.json();
      setRows(data.transactions ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setLoadError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, [
    page,
    sort,
    dir,
    debouncedSearch,
    filters.category,
    filters.type,
    filters.from,
    filters.to,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  function toggleSort(key: SortKey) {
    if (key === sort) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSort(key);
      // Dates and amounts are most useful largest-first; text reads A-Z.
      setDir(key === "description" || key === "category" ? "asc" : "desc");
    }
  }

  const filtered =
    Boolean(debouncedSearch) ||
    Boolean(filters.category) ||
    Boolean(filters.type) ||
    Boolean(filters.from) ||
    Boolean(filters.to);

  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        description="Everything recorded, sorted automatically."
        actions={
          <Button
            variant={showForm ? "secondary" : "primary"}
            onClick={() => setShowForm((s) => !s)}
            aria-expanded={showForm}
            aria-controls="add-transaction-form"
          >
            {showForm ? "Cancel" : "Add transaction"}
          </Button>
        }
      />

      {showForm && (
        <AddTransactionForm
          onAdded={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      <ImportPanel onImported={load} />

      <Card className="overflow-hidden">
        <div className="border-b border-ink-100 px-5 py-4">
          <TransactionFilters
            value={filters}
            onChange={setFilters}
            total={total}
            showing={rows.length}
          />
        </div>

        <div className="px-5">
          {loadError ? (
            <p role="alert" className="py-10 text-center text-body text-negative-700">
              {loadError}
            </p>
          ) : !loading && rows.length === 0 ? (
            <div className="py-6">
              <EmptyState
                title={filtered ? "Nothing matches those filters" : "No transactions yet"}
                description={
                  filtered
                    ? "Try a wider date range, or clear the filters to see everything."
                    : "Add one by hand, paste your bank alerts, or drop in a CSV — the assistant files each one for you."
                }
                action={
                  filtered ? (
                    <Button onClick={() => setFilters(EMPTY_FILTERS)}>
                      Clear filters
                    </Button>
                  ) : (
                    <Button variant="primary" onClick={() => setShowForm(true)}>
                      Add your first transaction
                    </Button>
                  )
                }
              />
            </div>
          ) : (
            <TransactionTable
              rows={rows}
              loading={loading}
              sort={sort}
              dir={dir}
              onSort={toggleSort}
              onSelect={setSelected}
              selectedId={selected?.id}
            />
          )}
        </div>

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between gap-3 border-t border-ink-100 px-5 py-3">
            <p className="text-label tnum text-ink-500">
              Page {page + 1} of {lastPage + 1}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || loading}
              >
                Previous
              </Button>
              <Button
                size="sm"
                onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                disabled={page >= lastPage || loading}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      <TransactionDrawer
        transaction={selected}
        onClose={() => setSelected(null)}
        onChanged={load}
      />
    </div>
  );
}

// --- Add form --------------------------------------------------------------

/**
 * Kept deliberately short. There is no category picker here: the classifier
 * chooses one from the description, and the drawer is where you correct it —
 * offering a field the create endpoint ignores would be a control that lies.
 */
function AddTransactionForm({ onAdded }: { onAdded: () => void }) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [date, setDate] = useState(localToday());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstField.current?.focus();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
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

    setBusy(true);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parsed,
          description: description.trim(),
          type,
          date,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not add that transaction.");
        return;
      }
      setAmount("");
      setDescription("");
      onAdded();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="animate-rise p-5" as="section">
      <form id="add-transaction-form" onSubmit={submit} noValidate>
        {error && (
          <p role="alert" className="mb-4 rounded-md bg-negative-50 p-3 text-body text-negative-700">
            {error}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-[auto_1fr_10rem_10rem]">
          <div className="flex self-end rounded-md border border-ink-200 p-0.5">
            {(["expense", "income"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                aria-pressed={type === t}
                className={cx(
                  "min-h-9 rounded-sm px-4 text-label font-medium transition-colors duration-[--duration-fast]",
                  type === t ? "bg-ink-900 text-paper" : "text-ink-600 hover:text-ink-900"
                )}
              >
                {t === "expense" ? "Money out" : "Money in"}
              </button>
            ))}
          </div>

          <div>
            <label htmlFor="t-desc" className="mb-1.5 block text-label font-medium text-ink-700">
              Description
            </label>
            <input
              id="t-desc"
              ref={firstField}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Groceries at Shoprite"
              maxLength={255}
              className={field}
            />
          </div>

          <div>
            <label htmlFor="t-amount" className="mb-1.5 block text-label font-medium text-ink-700">
              Amount
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-label text-ink-400">
                ₦
              </span>
              <input
                id="t-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className={cx(field, "pl-7 tnum")}
              />
            </div>
          </div>

          <div>
            <label htmlFor="t-date" className="mb-1.5 block text-label font-medium text-ink-700">
              Date
            </label>
            <input
              id="t-date"
              type="date"
              value={date}
              max={localToday()}
              onChange={(e) => setDate(e.target.value)}
              className={field}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Adding…" : "Add transaction"}
          </Button>
          <p className="text-label text-ink-500">
            The assistant picks the category from your description.
          </p>
        </div>
      </form>
    </Card>
  );
}

const field =
  "min-h-10 w-full rounded-md border border-ink-200 px-3 text-body text-ink-900 transition-colors duration-[--duration-fast] focus:border-ink-900 focus:outline-none";

function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
