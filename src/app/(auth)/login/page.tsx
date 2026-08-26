"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError("Invalid email or password");
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
    <div>
      <h1 className="text-3xl font-semibold tracking-[-0.025em] text-ink-950">
        Welcome back
      </h1>
      <p className="mt-2 text-body text-ink-600">
        Sign in to pick up where your money left off.
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

        <div>
          <label htmlFor="password" className="mb-1.5 block text-label font-medium text-ink-700">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={FIELD}
            placeholder="Enter your password"
            aria-required="true"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="min-h-11 w-full rounded-md bg-ink-900 px-4 text-body font-medium text-paper shadow-raised transition-[background-color,transform,box-shadow] duration-[--duration-base] ease-[--ease-out-quart] hover:-translate-y-0.5 hover:bg-ink-800 hover:shadow-overlay disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-ink-300 disabled:shadow-none motion-reduce:hover:translate-y-0"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <div className="flex flex-wrap items-center justify-between gap-2 text-body">
          <p className="text-ink-600">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="rounded-xs font-medium text-ink-900 underline-offset-2 hover:underline"
            >
              Create one
            </Link>
          </p>
          <Link
            href="/forgot-password"
            className="rounded-xs font-medium text-ink-500 underline-offset-2 hover:text-ink-800 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
      </form>
    </div>
  );
}

const FIELD =
  "min-h-11 w-full rounded-md border border-ink-200 bg-paper px-3 text-body text-ink-900 placeholder:text-ink-400 transition-colors duration-[--duration-fast] focus:border-ink-900 focus:outline-none";
