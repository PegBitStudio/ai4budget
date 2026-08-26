"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Renders its children into `document.body`, outside the component tree they
 * were written in.
 *
 * A full-screen `fixed` overlay only stays pinned to the true viewport if
 * every ancestor leaves `transform`, `filter`, `perspective` and `will-change`
 * alone — any of those on so much as one ancestor turns that ancestor into the
 * overlay's containing block instead of the viewport, and a drawer meant to
 * span the screen instead spans that ancestor's own content height. The
 * dashboard shell animates its page content in on load, which sets exactly
 * such a transform for the duration of that animation.
 *
 * A drawer or modal mounted straight into `<body>` cannot inherit that problem
 * from whatever page happens to render it, now or after a future page redesign
 * adds its own transform somewhere upstream — the fix is structural, not a
 * one-off value tuned to today's ancestor tree.
 */
export default function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  // document.body only exists once mounted in the browser; rendering this on
  // the server would either crash or portal into nothing.
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return createPortal(children, document.body);
}
