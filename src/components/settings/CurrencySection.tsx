"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, Button } from "@/components/ui/primitives";
import {
  CURRENCIES,
  DEFAULT_CURRENCY_CODE,
  currencyByCode,
} from "@/config/currencies";

/**
 * The currency the account keeps its books in.
 *
 * The warning is not boilerplate. Amounts are stored as plain numbers with no
 * unit, so switching from Naira to Euro does not convert ₦753,200 into €4,000 —
 * it relabels it as €753,200. That is the right behaviour for a budgeting tool,
 * which has no business inventing an exchange rate, but it is only honest if we
 * say so before the switch rather than after.
 */
export default function CurrencySection() {
  const [code, setCode] = useState(DEFAULT_CURRENCY_CODE);
  const [saved, setSaved] = useState(DEFAULT_CURRENCY_CODE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const current =
        (data.user?.user_metadata?.currency as string) ?? DEFAULT_CURRENCY_CODE;
      setCode(current);
      setSaved(current);
    });
  }, []);

  async function save() {
    setError(null);
    setBusy(true);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        data: { currency: code },
      });

      if (updateError) {
        setError("Could not save that. Please try again.");
        return;
      }

      setSaved(code);
      // A full reload, not a router refresh: the symbol is read once on the
      // server and pushed into the formatter at the top of the tree, so every
      // figure already rendered is holding the old one.
      window.location.reload();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const changed = code !== saved;
  const current = currencyByCode(saved);
  const next = currencyByCode(code);

  return (
    <Card as="section">
      <CardHeader
        title="Currency"
        description="What money is called and shown as throughout the app."
      />
      <div className="p-5">
        {error && (
          <p role="alert" className="mb-4 rounded-md bg-negative-50 p-3 text-body text-negative-700">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label
              htmlFor="currency"
              className="mb-1.5 block text-label font-medium text-ink-700"
            >
              Display currency
            </label>
            <select
              id="currency"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="min-h-10 rounded-md border border-ink-200 bg-paper px-3 text-body text-ink-900 transition-colors duration-[--duration-fast] focus:border-ink-900 focus:outline-none"
            >
              {CURRENCIES.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.symbol} {currency.name} ({currency.code})
                </option>
              ))}
            </select>
          </div>

          <Button
            variant="primary"
            onClick={save}
            disabled={busy || !changed}
          >
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>

        {changed ? (
          <p className="mt-4 rounded-md bg-warning-50 p-3 text-body leading-relaxed text-warning-700">
            <strong className="font-medium">
              This relabels your figures, it does not convert them.
            </strong>{" "}
            An amount recorded as {current.symbol}1,000 will show as{" "}
            {next.symbol}1,000, not its value in {next.name}. KoboPilot records
            what you spend; it does not apply exchange rates.
          </p>
        ) : (
          <p className="mt-4 text-label leading-relaxed text-ink-500">
            Amounts are stored as plain numbers, so this sets what they are
            labelled as. It is not a conversion and no exchange rate is applied.
          </p>
        )}
      </div>
    </Card>
  );
}
