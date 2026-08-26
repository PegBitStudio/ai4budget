"use client";

import { useEffect, useState } from "react";
import { quoteForDay, type Quote } from "@/lib/quotes";

/**
 * One line of borrowed sense, changing daily.
 *
 * Resolved after mount rather than during render: the server's day and the
 * reader's day are not always the same one, and a value that disagreed across
 * hydration would either warn or silently swap under them. Until it resolves
 * the block holds its own height, so nothing below it jumps.
 *
 * Quiet by design — it sits at the foot of the page, in muted ink, well after
 * the figures. It is the last thing you read, not the first.
 */
export default function DailyQuote() {
  const [quote, setQuote] = useState<Quote | null>(null);

  useEffect(() => setQuote(quoteForDay()), []);

  return (
    <figure className="min-h-16 border-t border-ink-100 pt-6">
      {quote && (
        <div className="animate-fade">
          <blockquote className="max-w-xl text-body leading-relaxed text-ink-600 [text-wrap:pretty]">
            “{quote.text}”
          </blockquote>
          <figcaption className="mt-1.5 text-label text-ink-500">
            {quote.attribution}
          </figcaption>
        </div>
      )}
    </figure>
  );
}
