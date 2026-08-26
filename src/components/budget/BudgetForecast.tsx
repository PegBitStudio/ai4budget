"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, Badge, cx } from "@/components/ui/primitives";
import { categoryColor } from "@/config/categories";
import { formatCurrency } from "@/utils/formatters";
import {
  fetchNotifications,
  type ForecastWithSentence,
} from "@/lib/notificationsClient";

/**
 * Where the month is heading, on the page where you can still do something
 * about it.
 *
 * Everything else on this screen reports what has already happened. This is the
 * only part that speaks about a month that has not finished yet, which is why
 * it earns space: "Dining finishes about ₦11,000 over, with 16 days to go" is a
 * decision. "Dining went ₦11,000 over" is a receipt.
 *
 * Unlike the bell — which suppresses a projection for a category that has
 * already blown its budget, to avoid saying the same thing twice — this shows
 * those too. On this page the projection is the useful half: that a category is
 * already over is something you know, and how much further it is going is not.
 */
export default function BudgetForecast() {
  const [forecasts, setForecasts] = useState<ForecastWithSentence[]>([]);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetchNotifications()
      .then((payload) => {
        if (cancelled) return;
        setForecasts(payload.forecasts);
        setDaysRemaining(payload.daysRemaining);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Nothing heading anywhere is not worth a card saying so — the progress bars
  // above already show every category sitting inside its plan.
  if (!loaded || forecasts.length === 0) {
    return null;
  }

  return (
    <Card as="section" className="animate-rise">
      <CardHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            Where this month is heading
            <Badge tone="ai">Forecast</Badge>
          </span>
        }
        description={
          daysRemaining === null
            ? "Projected from the spending you have recorded so far."
            : `Projected from the spending recorded so far, with ${daysRemaining} ${daysRemaining === 1 ? "day" : "days"} left in the period.`
        }
      />

      <ul className="divide-y divide-ink-100">
        {forecasts.map((forecast) => (
          <li key={forecast.category} className="flex gap-3 px-5 py-4">
            <span
              aria-hidden="true"
              className="mt-1.5 size-2 shrink-0 rounded-full"
              style={{ backgroundColor: categoryColor(forecast.category) }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-body font-medium text-ink-900">
                  {forecast.category}
                </p>
                <p
                  className={cx(
                    "text-label tnum",
                    forecast.verdict === "exceeded"
                      ? "text-negative-600"
                      : forecast.verdict === "will-exceed"
                        ? "text-warning-700"
                        : "text-ink-600"
                  )}
                >
                  {/* An arrow only where the projection actually moves. */}
                  {forecast.projected > forecast.spentSoFar
                    ? `${formatCurrency(forecast.spentSoFar)} → ${formatCurrency(forecast.projected)}`
                    : formatCurrency(forecast.spentSoFar)}
                  <span className="text-ink-500">
                    {" "}
                    of {formatCurrency(forecast.budgeted)}
                  </span>
                </p>
              </div>
              <p className="mt-1 text-body leading-relaxed text-ink-600">
                {forecast.sentence}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <p className="border-t border-ink-100 px-5 py-3 text-label leading-relaxed text-ink-500">
        A projection, not a prediction: it assumes the rest of the period looks
        like the part already recorded. Categories carried by a single large
        purchase are left out, because a one-off is not a rate.
      </p>
    </Card>
  );
}
