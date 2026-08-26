"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/**
 * Asking for a reset link.
 *
 * The confirmation is deliberately the same whether or not the address has an
 * account. "No user with that email" is a free account-existence check for
 * anyone who wants one, and on a financial product that is not a detail worth
 * leaking to save a moment's confusion.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Enter the email address you signed up with.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: `${window.location.origin}/reset-password` }
      );

      // Only a transport or configuration failure is worth reporting. A missing
      // account is not an error the sender is entitled to hear about.
      if (resetError && resetError.status !== 400) {
        setError("Could not send the reset link. Please try again shortly.");
        setLoading(false);
        return;
      }

      setSent(true);
    } catch {
      setError("Could not reach the server. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div>
        <h1 className="text-3xl font-semibold tracking-[-0.025em] text-ink-950">
          Check your email
        </h1>
        <p className="mt-3 text-body leading-relaxed text-ink-600">
          If an account exists for{" "}
          <span className="font-medium text-ink-900">{email.trim()}</span>, a
          link to set a new password is on its way. It expires in an hour.
        </p>
        <p className="mt-4 text-body leading-relaxed text-ink-600">
          Nothing arrived? Check the spam folder, then try again — the address
          has to match the one you signed up with.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-ink-900 px-5 text-body font-medium text-paper transition-colors duration-[--duration-fast] hover:bg-ink-800"
          >
            Back to sign in
          </Link>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-ink-200 px-5 text-body font-medium text-ink-800 transition-colors duration-[--duration-fast] hover:border-ink-300 hover:bg-ink-50"
          >
            Use a different address
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-[-0.025em] text-ink-950">
        Reset your password
      </h1>
      <p className="mt-2 text-body text-ink-600">
        Enter your email and we will send you a link to set a new one.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-4">
        {error && (
          <p role="alert" className="rounded-md bg-negative-50 p-3 text-body text-negative-700">
            {error}
          </p>
        )}

        <div>
          <label htmlFor="email" className="mb-1.5 block text-label font-medium text-ink-700">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={FIELD}
            placeholder="you@example.com"
            aria-required="true"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="min-h-11 w-full rounded-md bg-ink-900 px-4 text-body font-medium text-paper shadow-raised transition-[background-color,transform,box-shadow] duration-[--duration-base] ease-[--ease-out-quart] hover:-translate-y-0.5 hover:bg-ink-800 hover:shadow-overlay disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-ink-300 disabled:shadow-none motion-reduce:hover:translate-y-0"
        >
          {loading ? "Sending…" : "Send reset link"}
        </button>

        <p className="text-body text-ink-600">
          Remembered it?{" "}
          <Link
            href="/login"
            className="rounded-xs font-medium text-ink-900 underline-offset-2 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}

const FIELD =
  "min-h-11 w-full rounded-md border border-ink-200 bg-paper px-3 text-body text-ink-900 placeholder:text-ink-400 transition-colors duration-[--duration-fast] focus:border-ink-900 focus:outline-none";
