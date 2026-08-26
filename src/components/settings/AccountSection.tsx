"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AccountSection() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <section className="rounded-lg border border-ink-200 bg-paper p-5 shadow-card">
      <h2 className="mb-2 text-lg font-semibold text-ink-900">Account</h2>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-ink-600">Signed in as</p>
          <p className="truncate text-sm font-medium text-ink-900">
            {email ?? "…"}
          </p>
        </div>
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="min-h-[44px] rounded-lg border border-ink-300 px-5 py-3 font-medium text-ink-700 transition-colors hover:border-ink-300 hover:bg-ink-50 hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </section>
  );
}
