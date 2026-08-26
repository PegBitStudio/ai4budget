"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DemoLoginButton() {
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
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-ink-900 px-5 text-body font-medium text-paper transition-colors duration-[--duration-fast] hover:bg-ink-800 disabled:cursor-not-allowed disabled:bg-ink-300"
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
          "Explore the demo account"
        )}
      </button>
      {error && (
        <p role="alert" className="text-label text-negative-600">
          {error}
        </p>
      )}
    </div>
  );
}
