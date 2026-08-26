"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/**
 * Setting the new password.
 *
 * Arriving here from the emailed link puts Supabase into a short-lived recovery
 * session, which is what authorises the change. The page waits for that session
 * before showing the form: rendering the fields first and failing on submit
 * would look like the new password was rejected, when in fact the link was.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState<"checking" | "ok" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    // A session is NOT enough to authorise this. Anyone already signed in has
    // one, so accepting it would let a visitor to the shared demo account set a
    // new password and lock everybody out of it. What authorises a reset is
    // arriving from the emailed link, which is either a PASSWORD_RECOVERY event
    // or the recovery markers the link carries in the URL.
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
    const arrivedFromLink =
      hash.get("type") === "recovery" ||
      url.searchParams.get("type") === "recovery" ||
      url.searchParams.has("code") ||
      url.searchParams.has("token_hash");

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady("ok");
      }
    });

    if (arrivedFromLink) {
      // Give Supabase a moment to exchange the token before deciding.
      supabase.auth.getSession().then(({ data }) => {
        setReady((current) =>
          current === "ok" ? current : data.session ? "ok" : "invalid"
        );
      });
    } else {
      setReady((current) => (current === "ok" ? current : "invalid"));
    }

    return () => listener.subscription.unsubscribe();
  }, []);

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

    setLoading(true);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError(
          updateError.message.toLowerCase().includes("same")
            ? "That is already your password. Choose a different one."
            : "Could not set that password. The link may have expired — request a new one."
        );
        setLoading(false);
        return;
      }

      setDone(true);
      // Straight into the app: the recovery session is a signed-in session, so
      // sending them back to a login form would be asking for the password they
      // just set.
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 1400);
    } catch {
      setError("Could not reach the server. Please try again.");
      setLoading(false);
    }
  }

  if (ready === "checking") {
    return (
      <div>
        <h1 className="text-3xl font-semibold tracking-[-0.025em] text-ink-950">
          Checking your link…
        </h1>
        <p className="mt-2 text-body text-ink-600">One moment.</p>
      </div>
    );
  }

  if (ready === "invalid") {
    return (
      <div>
        <h1 className="text-3xl font-semibold tracking-[-0.025em] text-ink-950">
          That link has expired
        </h1>
        <p className="mt-3 text-body leading-relaxed text-ink-600">
          Reset links last an hour and work once. Request a fresh one and it will
          arrive in a moment.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/forgot-password"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-ink-900 px-5 text-body font-medium text-paper transition-colors duration-[--duration-fast] hover:bg-ink-800"
          >
            Send a new link
          </Link>
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-ink-200 px-5 text-body font-medium text-ink-800 transition-colors duration-[--duration-fast] hover:border-ink-300 hover:bg-ink-50"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div>
        <h1 className="text-3xl font-semibold tracking-[-0.025em] text-ink-950">
          Password updated
        </h1>
        <p className="mt-3 text-body text-ink-600">
          Taking you to your dashboard…
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-[-0.025em] text-ink-950">
        Set a new password
      </h1>
      <p className="mt-2 text-body text-ink-600">
        Choose something you have not used here before.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-4">
        {error && (
          <p role="alert" className="rounded-md bg-negative-50 p-3 text-body text-negative-700">
            {error}
          </p>
        )}

        <div>
          <label htmlFor="password" className="mb-1.5 block text-label font-medium text-ink-700">
            New password
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
          />
        </div>

        <div>
          <label
            htmlFor="confirm-password"
            className="mb-1.5 block text-label font-medium text-ink-700"
          >
            Confirm new password
          </label>
          <input
            id="confirm-password"
            name="confirmPassword"
            type="password"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={FIELD}
            placeholder="Re-enter it"
            aria-required="true"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="min-h-11 w-full rounded-md bg-ink-900 px-4 text-body font-medium text-paper shadow-raised transition-[background-color,transform,box-shadow] duration-[--duration-base] ease-[--ease-out-quart] hover:-translate-y-0.5 hover:bg-ink-800 hover:shadow-overlay disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-ink-300 disabled:shadow-none motion-reduce:hover:translate-y-0"
        >
          {loading ? "Saving…" : "Set new password"}
        </button>
      </form>
    </div>
  );
}

const FIELD =
  "min-h-11 w-full rounded-md border border-ink-200 bg-paper px-3 text-body text-ink-900 placeholder:text-ink-400 transition-colors duration-[--duration-fast] focus:border-ink-900 focus:outline-none";
