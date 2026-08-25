"use client";

import { useState } from "react";
import { formatCurrency } from "@/utils/formatters";
import { CATEGORIES, Category } from "@/models/category";

// --- Types ---

interface ParsedRow {
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: Category;
  duplicate: boolean;
}

interface ParseIssue {
  index: number;
  reason: string;
}

interface ReviewRow extends ParsedRow {
  key: string;
  include: boolean;
}

type Stage = "paste" | "review";

const EXAMPLE = `Txn: NGN4,550.00
Acc: ****1234
Desc: POS/WEB PURCHASE/BOLT
Date: 12-AUG-2026
Bal: NGN45,231.09

Debit Alert
Amount: NGN 7,800.00
Description: CHICKEN REPUBLIC IKEJA
Date & Time: 13-Aug-2026 13:04:22

You sent ₦12,000.00 to MTN VTU on 5 Aug 2026. Your balance is ₦33,120.00`;

// --- Component ---

export default function AlertImporter({
  onImported,
}: {
  onImported: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("paste");
  const [text, setText] = useState("");
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [issues, setIssues] = useState<ParseIssue[]>([]);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  function reset() {
    setStage("paste");
    setText("");
    setRows([]);
    setIssues([]);
    setError(null);
  }

  async function handleParse() {
    setError(null);
    setResult(null);
    setParsing(true);

    try {
      const res = await fetch("/api/import/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Could not read those alerts.");
        return;
      }

      const parsed: ParsedRow[] = data.transactions ?? [];

      if (parsed.length === 0) {
        setError(
          "No transactions found in that text. Check you pasted the alert messages themselves, not a statement summary."
        );
        setIssues(data.issues ?? []);
        return;
      }

      setRows(
        parsed.map((row, i) => ({
          ...row,
          key: `${row.date}-${row.amount}-${i}`,
          // Anything that looks already-imported starts unticked.
          include: !row.duplicate,
        }))
      );
      setIssues(data.issues ?? []);
      setStage("review");
    } catch {
      setError("Could not reach the server. Please check your connection.");
    } finally {
      setParsing(false);
    }
  }

  async function handleImport() {
    const selected = rows.filter((r) => r.include);
    if (selected.length === 0) return;

    setError(null);
    setSaving(true);

    try {
      const res = await fetch("/api/transactions/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "bank-alert",
          transactions: selected.map((r) => ({
            date: r.date,
            description: r.description,
            amount: r.amount,
            type: r.type,
            category: r.category,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Could not save those transactions.");
        return;
      }

      setResult(
        `Added ${data.imported} transaction${data.imported === 1 ? "" : "s"}.`
      );
      reset();
      setOpen(false);
      onImported();
    } catch {
      setError("Could not reach the server. Please check your connection.");
    } finally {
      setSaving(false);
    }
  }

  function updateRow(key: string, patch: Partial<ReviewRow>) {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r))
    );
  }

  const selectedCount = rows.filter((r) => r.include).length;
  const duplicateCount = rows.filter((r) => r.duplicate).length;

  if (!open) {
    return (
      <div className="mb-4">
        <button
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-violet-300 bg-violet-50/60 p-4 text-left transition-colors hover:border-violet-400 hover:bg-violet-50"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M7.5 3.75A1.5 1.5 0 0 0 6 5.25v13.5a1.5 1.5 0 0 0 1.5 1.5h9a1.5 1.5 0 0 0 1.5-1.5V5.25a1.5 1.5 0 0 0-1.5-1.5h-.75V6a.75.75 0 0 1-.75.75h-6A.75.75 0 0 1 8.25 6V3.75H7.5Z" />
              <path d="M9.75 2.25h4.5V6h-4.5V2.25Z" />
            </svg>
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-900">
              Paste your bank alerts
            </span>
            <span className="block text-sm text-slate-600">
              Drop in the debit alerts from your phone and the assistant turns
              them into transactions.
            </span>
          </span>
        </button>
        {result && (
          <p role="status" className="mt-3 text-sm font-medium text-emerald-700">
            {result}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-2xl border border-violet-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            {stage === "paste"
              ? "Paste your bank alerts"
              : "Check these before they are saved"}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {stage === "paste"
              ? "Copy the debit and credit alerts from your messages. Any bank, any format, as many as you like."
              : "Nothing has been saved yet. Untick anything that looks wrong and fix any category the assistant misread."}
          </p>
        </div>
        <button
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="shrink-0 rounded-lg px-2 py-1 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          Close
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
        >
          {error}
        </p>
      )}

      {stage === "paste" ? (
        <>
          <label htmlFor="alert-text" className="sr-only">
            Bank alert messages
          </label>
          <textarea
            id="alert-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={9}
            placeholder={EXAMPLE}
            className="mt-4 block w-full rounded-xl border border-slate-300 p-3 font-mono text-sm leading-6 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              onClick={handleParse}
              disabled={parsing || !text.trim()}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-violet-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {parsing ? (
                <>
                  <Spinner />
                  Reading your alerts…
                </>
              ) : (
                "Read these alerts"
              )}
            </button>
            <p className="text-xs text-slate-500">
              Your alerts are sent to the AI assistant to be read. Account
              numbers are stripped and never stored.
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <p className="font-medium text-slate-900">
              Found {rows.length} transaction{rows.length === 1 ? "" : "s"}
            </p>
            {duplicateCount > 0 && (
              <p className="text-amber-700">
                {duplicateCount} look already imported and{" "}
                {duplicateCount === 1 ? "is" : "are"} unticked
              </p>
            )}
            {issues.length > 0 && (
              <p className="text-slate-500">
                {issues.length} line{issues.length === 1 ? "" : "s"} could not be
                read
              </p>
            )}
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[38rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th scope="col" className="w-10 py-2">
                    <span className="sr-only">Include</span>
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium text-slate-500">
                    Date
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium text-slate-500">
                    Description
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium text-slate-500">
                    Category
                  </th>
                  <th
                    scope="col"
                    className="py-2 text-right font-medium text-slate-500"
                  >
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.key}
                    className={`border-b border-slate-100 ${
                      row.include ? "" : "opacity-50"
                    }`}
                  >
                    <td className="py-2">
                      <input
                        type="checkbox"
                        checked={row.include}
                        onChange={(e) =>
                          updateRow(row.key, { include: e.target.checked })
                        }
                        aria-label={`Include ${row.description}`}
                        className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                      />
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap text-slate-600 tabular-nums">
                      {formatShortDate(row.date)}
                    </td>
                    <td className="py-2 pr-3 text-slate-900">
                      <span className="block max-w-[16rem] truncate">
                        {row.description}
                      </span>
                      {row.duplicate && (
                        <span className="mt-0.5 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
                          Already imported
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {row.type === "income" ? (
                        <span className="text-emerald-700">Income</span>
                      ) : (
                        <select
                          value={row.category}
                          onChange={(e) =>
                            updateRow(row.key, {
                              category: e.target.value as Category,
                            })
                          }
                          aria-label={`Category for ${row.description}`}
                          className="rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td
                      className={`py-2 text-right font-medium tabular-nums ${
                        row.type === "income"
                          ? "text-emerald-700"
                          : "text-slate-900"
                      }`}
                    >
                      {row.type === "income" ? "+" : "−"}
                      {formatCurrency(row.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {issues.length > 0 && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-slate-600">
                What could not be read
              </summary>
              <ul className="mt-2 space-y-1 pl-4 text-slate-500">
                {issues.map((issue, i) => (
                  <li key={i} className="list-disc">
                    {issue.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={handleImport}
              disabled={saving || selectedCount === 0}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-violet-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Spinner />
                  Saving…
                </>
              ) : (
                `Add ${selectedCount} transaction${selectedCount === 1 ? "" : "s"}`
              )}
            </button>
            <button
              onClick={() => setStage("paste")}
              className="min-h-[44px] rounded-xl px-4 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Back to the text
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// --- Helpers ---

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

function formatShortDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}
