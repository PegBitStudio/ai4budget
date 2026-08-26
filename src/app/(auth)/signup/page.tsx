"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [disclaimerAcknowledged, setDisclaimerAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!disclaimerAcknowledged) {
      setError("You must acknowledge the disclaimer to continue");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        if (authError.message.toLowerCase().includes("already registered")) {
          setError("This email is already registered");
        } else {
          setError(authError.message);
        }
        setLoading(false);
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {error && (
        <div
          role="alert"
          className="rounded-md bg-negative-50 p-3 text-sm text-negative-700"
        >
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-ink-700"
        >
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
          className="mt-1 block w-full rounded-md border border-ink-300 px-3 py-2 text-base shadow-card placeholder:text-ink-400 focus:border-ink-700 focus:outline-none focus:ring-1 focus:ring-ink-700 min-h-[44px]"
          placeholder="you@example.com"
          aria-required="true"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-ink-700"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 block w-full rounded-md border border-ink-300 px-3 py-2 text-base shadow-card placeholder:text-ink-400 focus:border-ink-700 focus:outline-none focus:ring-1 focus:ring-ink-700 min-h-[44px]"
          placeholder="Min. 6 characters"
          aria-required="true"
          aria-describedby="password-hint"
        />
        <p id="password-hint" className="mt-1 text-xs text-ink-500">
          Must be at least 6 characters
        </p>
      </div>

      <div>
        <label
          htmlFor="confirm-password"
          className="block text-sm font-medium text-ink-700"
        >
          Confirm Password
        </label>
        <input
          id="confirm-password"
          name="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="mt-1 block w-full rounded-md border border-ink-300 px-3 py-2 text-base shadow-card placeholder:text-ink-400 focus:border-ink-700 focus:outline-none focus:ring-1 focus:ring-ink-700 min-h-[44px]"
          placeholder="Re-enter your password"
          aria-required="true"
        />
      </div>

      <div className="flex items-start gap-3">
        <input
          id="disclaimer"
          name="disclaimer"
          type="checkbox"
          checked={disclaimerAcknowledged}
          onChange={(e) => setDisclaimerAcknowledged(e.target.checked)}
          className="mt-0.5 h-5 w-5 rounded border-ink-300 text-ink-900 focus:ring-ink-700 min-h-[44px] min-w-[20px]"
          aria-required="true"
        />
        <label htmlFor="disclaimer" className="text-sm text-ink-600">
          I understand this is a budgeting tool and not professional financial
          advice
        </label>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-ink-900 px-4 py-2 text-base font-medium text-paper shadow-card hover:bg-ink-900 focus:outline-none focus:ring-2 focus:ring-ink-700 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px]"
      >
        {loading ? "Creating account..." : "Create Account"}
      </button>

      <p className="text-center text-sm text-ink-600">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-ink-900 hover:text-ink-900"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
