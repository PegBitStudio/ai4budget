"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Counts a figure up to its value once, on first appearance.
 *
 * The point is not decoration — it is that the eye is drawn to the number
 * settling, which is exactly where attention belongs on a financial summary.
 * It runs once and then holds; a figure that re-animates on every render is
 * distracting rather than confident.
 *
 * Honours prefers-reduced-motion by landing on the final value immediately.
 */
export function useCountUp(target: number, durationMs = 700): number {
  const [value, setValue] = useState(() => target);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) {
      // After the first pass, follow the value directly.
      setValue(target);
      return;
    }
    hasRun.current = true;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (reduced || !Number.isFinite(target) || target === 0) {
      setValue(target);
      return;
    }

    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      // Quartic ease-out: fast arrival, gentle settle.
      const eased = 1 - Math.pow(1 - progress, 4);
      setValue(target * eased);

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        setValue(target);
      }
    };

    setValue(0);
    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return value;
}
