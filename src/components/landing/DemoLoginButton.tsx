"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * `tone` picks which surface the button expects to sit on. Ink-on-ink is
 * invisible, so on the dark hero the primary action inverts to paper rather
 * than dropping to a secondary style — it is still the primary action there.
 */
export default function DemoLoginButton({
  tone = "ink",
}: {
  tone?: "ink" | "paper";
} = {}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openDemo() {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/demo", { method: "POST" });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not open the demo account.");
        setLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Could not reach the server. Please check your connection.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={openDemo}
        disabled={loading}
        className={`group inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-5 text-body font-medium shadow-raised transition-[background-color,transform,box-shadow] duration-[--duration-base] ease-[--ease-out-quart] hover:-translate-y-0.5 hover:shadow-overlay disabled:cursor-not-allowed disabled:shadow-none motion-reduce:hover:translate-y-0 ${
          tone === "paper"
            ? "bg-paper text-ink-950 hover:bg-ink-50 disabled:bg-ink-300 disabled:text-ink-500"
            : "bg-ink-900 text-paper hover:bg-ink-800 disabled:bg-ink-300"
        }`}
      >
        {loading ? (
          <>
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
            Opening the demo…
          </>
        ) : (
          <>
            Explore the demo account
            {/* The arrow leans forward under the cursor — a small promise that
                the button goes somewhere. */}
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="size-4 transition-transform duration-[--duration-base] ease-[--ease-out-quart] group-hover:translate-x-0.5"
            >
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
          </>
        )}
      </button>
      {error && (
        <p
          role="alert"
          // On the dark hero the standard red is too dark to read against the
          // surface, so the message takes the light step instead.
          className={`text-label ${tone === "paper" ? "text-negative-100" : "text-negative-600"}`}
        >
          {error}
        </p>
      )}
    </div>
  );
}
