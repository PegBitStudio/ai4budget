"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, Button } from "@/components/ui/primitives";

/**
 * The name the app calls you by.
 *
 * Asked for explicitly rather than guessed from the email address. The local
 * part of an address is usually not a name — the demo account would greet
 * itself as "Hello" — and a product that gets your name wrong every morning is
 * worse company than one that does not use it at all.
 *
 * Stored in Supabase auth metadata rather than a table of its own: it belongs
 * to the account, not to the financial data, and it is the one thing here that
 * should survive even if every transaction is deleted.
 */
export default function ProfileSection() {
  const [name, setName] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const current = (data.user?.user_metadata?.full_name as string) ?? "";
      setName(current);
      setSaved(current);
    });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const supabase = createClient();
      const trimmed = name.trim();
      const { error: updateError } = await supabase.auth.updateUser({
        data: { full_name: trimmed },
      });

      if (updateError) {
        setError("Could not save that. Please try again.");
        return;
      }
      setSaved(trimmed);
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const changed = name.trim() !== (saved ?? "");

  return (
    <Card as="section">
      <CardHeader
        title="Your name"
        description="Used to greet you on the overview. Leave it blank and the app will simply not use a name."
      />
      <form onSubmit={save} noValidate className="p-5">
        {error && (
          <p role="alert" className="mb-4 rounded-md bg-negative-50 p-3 text-body text-negative-700">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <label htmlFor="full-name" className="mb-1.5 block text-label font-medium text-ink-700">
              First name
            </label>
            <input
              id="full-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              placeholder="e.g. Damilola"
              className="min-h-10 w-full max-w-xs rounded-md border border-ink-200 bg-paper px-3 text-body text-ink-900 placeholder:text-ink-400 transition-colors duration-[--duration-fast] focus:border-ink-900 focus:outline-none"
            />
          </div>
          <Button type="submit" variant="primary" disabled={busy || !changed}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>

        {saved && !changed && (
          <p className="mt-3 text-label text-ink-500">
            The overview will greet you as “{saved}”.
          </p>
        )}
      </form>
    </Card>
  );
}
