"use client";

import { useRef, useState } from "react";
import { Category } from "@/models/category";
import ImportReviewTable, { ReviewRow } from "./ImportReviewTable";

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
  reason: string;
}

type Mode = "alerts" | "csv";
type Stage = "input" | "review";

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

export default function ImportPanel({
  onImported,
}: {
  onImported: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("alerts");
  const [stage, setStage] = useState<Stage>("input");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [issues, setIssues] = useState<ParseIssue[]>([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  function reset() {
    setStage("input");
    setText("");
    setFileName(null);
    setRows([]);
    setIssues([]);
    setError(null);
  }

  function receive(data: { transactions?: ParsedRow[]; issues?: ParseIssue[] }) {
    const parsed = data.transactions ?? [];
    setIssues(data.issues ?? []);

    if (parsed.length === 0) {
      setError(
        mode === "alerts"
          ? "No transactions found in that text. Check you pasted the alert messages themselves, not a statement summary."
          : "No usable rows in that file. It should have a date, a description and an amount in the first three columns."
      );
      return;
    }

    setRows(
      parsed
        // Newest first, matching the transaction list. Parsed rows arrive in
        // whichever order the batches resolved, which reads as scrambled.
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((row, i) => ({
          ...row,
          key: `${row.date}-${row.amount}-${i}`,
          // Anything that looks already-imported starts unticked.
          include: !row.duplicate,
        }))
    );
    setStage("review");
  }

  async function parseAlerts() {
    setError(null);
    setResult(null);
    setBusy(true);
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
      receive(data);
    } catch {
      setError("Could not reach the server. Please check your connection.");
    } finally {
      setBusy(false);
    }
  }

  async function parseFile(file: File) {
    setError(null);
    setResult(null);
    setFileName(file.name);
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/import/csv", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not read that file.");
        return;
      }
      receive(data);
    } catch {
      setError("Could not reach the server. Please check your connection.");
    } finally {
      setBusy(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) parseFile(file);
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
          source: mode === "alerts" ? "bank-alert" : "csv",
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
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
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
              Import your spending
            </span>
            <span className="block text-sm text-slate-600">
              Paste the debit alerts from your phone, or drop in a CSV. The
              assistant sorts them for you.
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
            {stage === "input"
              ? "Import your spending"
              : "Check these before they are saved"}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {stage === "input"
              ? "Any bank, any format, as many as you like."
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

      {stage === "input" ? (
        <>
          <div
            className="mt-4 flex gap-1 rounded-xl bg-slate-100 p-1"
            role="tablist"
            aria-label="How to import"
          >
            <ModeTab
              active={mode === "alerts"}
              onClick={() => {
                setMode("alerts");
                setError(null);
              }}
            >
              Paste bank alerts
            </ModeTab>
            <ModeTab
              active={mode === "csv"}
              onClick={() => {
                setMode("csv");
                setError(null);
              }}
            >
              Upload a CSV
            </ModeTab>
          </div>

          {mode === "alerts" ? (
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
                className="mt-3 block w-full rounded-xl border border-slate-300 p-3 font-mono text-sm leading-6 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  onClick={parseAlerts}
                  disabled={busy || !text.trim()}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-violet-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? (
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
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className={`mt-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                  dragging
                    ? "border-violet-500 bg-violet-50"
                    : "border-slate-300 bg-slate-50"
                }`}
              >
                <p className="text-sm font-medium text-slate-900">
                  {busy
                    ? "Reading your file…"
                    : fileName
                      ? fileName
                      : "Drop a CSV file here"}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Columns: date, description, amount — plus category and type if
                  you have them. A header row is fine.
                </p>
                <button
                  onClick={() => fileInput.current?.click()}
                  disabled={busy}
                  className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-violet-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? (
                    <>
                      <Spinner />
                      Reading…
                    </>
                  ) : (
                    "Choose a file"
                  )}
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) parseFile(file);
                    e.target.value = "";
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Exports from this app import straight back, categories and all.
              </p>
            </>
          )}
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
                {issues.length} could not be read
              </p>
            )}
          </div>

          <div className="mt-3">
            <ImportReviewTable rows={rows} onChange={updateRow} />
          </div>

          {issues.length > 0 && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-slate-600">
                What could not be read
              </summary>
              <ul className="mt-2 space-y-1 pl-4 text-slate-500">
                {issues.slice(0, 25).map((issue, i) => (
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
              onClick={() => setStage("input")}
              className="min-h-[44px] rounded-xl px-4 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Start over
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// --- Sub-components ---

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-white text-violet-700 shadow-sm"
          : "text-slate-600 hover:text-slate-900"
      }`}
    >
      {children}
    </button>
  );
}

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
