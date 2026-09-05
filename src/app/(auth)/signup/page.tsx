"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CURRENCIES, DEFAULT_CURRENCY_CODE } from "@/config/currencies";
import { createClient } from "@/lib/supabase/client";

/**
 * Confirming the email, not the typing.
 *
 * A "confirm password" field only catches a typo — it says nothing about
 * whether the address is real or theirs. A code sent to that address does
 * both jobs: it is its own confirmation field, and it proves the account is
 * reachable before it is trusted with anything.
 */
export default function SignupPage() {
  const router = useRouter();
  const [stage, setStage] = useState<"details" | "verify">("details");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY_CODE);
  const [disclaimerAcknowledged, setDisclaimerAcknowledged] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
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
        options: { data: { currency } },
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

      setLoading(false);
      setStage("verify");
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const token = code.trim();
    if (!token) {
      setError("Enter the code from your email.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "signup",
      });

      if (verifyError) {
        setError("That code is incorrect or has expired. Request a new one below.");
        setLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
      setLoading(false);
    }
  }

  async function handleResend() {
    setError(null);
    setResent(false);
    setResending(true);

    try {
      const supabase = createClient();
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email,
      });

      if (resendError) {
        setError("Could not resend the code. Please try again shortly.");
      } else {
        setResent(true);
      }
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setResending(false);
    }
  }

  if (stage === "verify") {
    return (
      <div>
        <h1 className="text-3xl font-semibold tracking-[-0.025em] text-ink-950">
          Check your email
        </h1>
        <p className="mt-3 text-body leading-relaxed text-ink-600">
          We sent a confirmation code to{" "}
          <span className="font-medium text-ink-900">{email}</span>. Enter it
          below to confirm the account.
        </p>

        <form onSubmit={handleVerify} noValidate className="mt-8 space-y-4">
          {error && (
            <p role="alert" className="rounded-md bg-negative-50 p-3 text-body text-negative-700">
              {error}
            </p>
          )}

          <div>
            <label htmlFor="otp" className="mb-1.5 block text-label font-medium text-ink-700">
              Verification code
            </label>
            <input
              id="otp"
              name="otp"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={12}
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 12))}
              className={`${FIELD} tracking-[0.3em] text-center text-lg`}
              placeholder="Enter code"
              aria-required="true"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="min-h-11 w-full rounded-md bg-ink-900 px-4 text-body font-medium text-paper shadow-raised transition-[background-color,transform,box-shadow] duration-[--duration-base] ease-[--ease-out-quart] hover:-translate-y-0.5 hover:bg-ink-800 hover:shadow-overlay disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-ink-300 disabled:shadow-none motion-reduce:hover:translate-y-0"
          >
            {loading ? "Verifying…" : "Verify and continue"}
          </button>

          <p className="text-body text-ink-600">
            Didn&apos;t get it?{" "}
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="rounded-xs font-medium text-ink-900 underline-offset-2 hover:underline disabled:text-ink-400"
            >
              {resending ? "Sending…" : "Resend code"}
            </button>
            {resent && (
              <span className="ml-1 text-positive-700">Sent — check your inbox.</span>
            )}
          </p>
        </form>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-[-0.025em] text-ink-950">
        Create your account
      </h1>
      <p className="mt-2 text-body text-ink-600">
        Start with your own figures. It takes about a minute.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-4">
      {error && (
        <p role="alert" className="rounded-md bg-negative-50 p-3 text-body text-negative-700">
          {error}
        </p>
      )}

      <div>
        <label
          htmlFor="email"
          className="mb-1.5 block text-label font-medium text-ink-700"
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
          className={FIELD}
          placeholder="you@example.com"
          aria-required="true"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="mb-1.5 block text-label font-medium text-ink-700"
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
          className={FIELD}
          placeholder="Min. 6 characters"
          aria-required="true"
          aria-describedby="password-hint"
        />
        <p id="password-hint" className="mt-1 text-xs text-ink-500">
          Must be at least 6 characters. We&apos;ll email you a code next to
          confirm it&apos;s really you.
        </p>
      </div>

      <div>
        <label
          htmlFor="currency"
          className="mb-1.5 block text-label font-medium text-ink-700"
        >
          Currency
        </label>
        <select
          id="currency"
          name="currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className={FIELD}
        >
          {CURRENCIES.map((option) => (
            <option key={option.code} value={option.code}>
              {option.symbol} {option.name} ({option.code})
            </option>
          ))}
        </select>
        {/* Said here rather than discovered later: this sets what amounts are
            labelled as, and KoboPilot never applies an exchange rate. */}
        <p className="mt-1 text-xs text-ink-500">
          What your money is shown as. You can change it later.
        </p>
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
        className="min-h-11 w-full rounded-md bg-ink-900 px-4 text-body font-medium text-paper shadow-raised transition-[background-color,transform,box-shadow] duration-[--duration-base] ease-[--ease-out-quart] hover:-translate-y-0.5 hover:bg-ink-800 hover:shadow-overlay disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-ink-300 disabled:shadow-none motion-reduce:hover:translate-y-0"
      >
        {loading ? "Sending code…" : "Create Account"}
      </button>

      <p className="text-body text-ink-600">
        Already have an account?{" "}
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
