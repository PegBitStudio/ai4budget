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
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 block w-full rounded-md border border-ink-300 px-3 py-2 text-base shadow-card placeholder:text-ink-400 focus:border-ink-700 focus:outline-none focus:ring-1 focus:ring-ink-700 min-h-[44px]"
          placeholder="Enter your password"
          aria-required="true"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-ink-900 px-4 py-2 text-base font-medium text-paper shadow-card hover:bg-ink-900 focus:outline-none focus:ring-2 focus:ring-ink-700 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px]"
      >
        {loading ? "Signing in..." : "Sign In"}
      </button>

      <div className="flex items-center justify-between text-sm">
        <p className="text-ink-600">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-medium text-ink-900 hover:text-ink-900"
          >
            Create one
          </Link>
        </p>
        <button
          type="button"
          onClick={() => alert("Please contact support to reset your password.")}
          className="font-medium text-ink-500 hover:text-ink-700"
        >
          Forgot password?
        </button>
      </div>
    </form>
  );
}
