"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, cx } from "@/components/ui/primitives";
import {
  applyThemeChoice,
  readThemeChoice,
  THEME_CHOICES,
  type ThemeChoice,
} from "@/lib/theme";

const LABELS: Record<ThemeChoice, { name: string; hint: string }> = {
  light: { name: "Light", hint: "Always light" },
  dark: { name: "Dark", hint: "Always dark" },
  system: { name: "System", hint: "Follow your device" },
};

/**
 * Three states, not a switch.
 *
 * A two-way toggle cannot say "follow my device", so anyone whose phone turns
 * dark in the evening has to come back and change it again. System is the
 * default and stays an option.
 */
export default function AppearanceSection() {
  const [choice, setChoice] = useState<ThemeChoice | null>(null);

  // Read after mount: the stored value only exists on the client, and rendering
  // a guess on the server would flash the wrong option as selected.
  useEffect(() => setChoice(readThemeChoice()), []);

  function pick(next: ThemeChoice) {
    applyThemeChoice(next);
    setChoice(next);
  }

  return (
    <Card as="section">
      <CardHeader
        title="Appearance"
        description="How KoboPilot looks on this device. Not shared with your other devices."
      />
      <div
        className="flex flex-wrap gap-2 p-5"
        role="radiogroup"
        aria-label="Colour theme"
      >
        {THEME_CHOICES.map((option) => {
          const selected = choice === option;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => pick(option)}
              className={cx(
                "flex min-h-11 flex-1 items-center gap-3 rounded-md border px-4 text-left",
                "transition-colors duration-[--duration-fast]",
                selected
                  ? "border-ink-900 bg-ink-50"
                  : "border-ink-200 hover:border-ink-300 hover:bg-ink-50"
              )}
            >
              <Swatch option={option} />
              <span className="min-w-0">
                <span className="block text-body font-medium text-ink-900">
                  {LABELS[option].name}
                </span>
                <span className="block text-label text-ink-500">
                  {LABELS[option].hint}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

/** A literal preview, so the choice is not carried by the word alone. */
function Swatch({ option }: { option: ThemeChoice }) {
  const base = "size-6 shrink-0 overflow-hidden rounded-sm border border-ink-300";

  if (option === "light") {
    return <span aria-hidden="true" className={cx(base, "bg-[#f7f8f7]")} />;
  }
  if (option === "dark") {
    return <span aria-hidden="true" className={cx(base, "bg-[#0c0f10]")} />;
  }
  return (
    <span aria-hidden="true" className={cx(base, "flex")}>
      <span className="w-1/2 bg-[#f7f8f7]" />
      <span className="w-1/2 bg-[#0c0f10]" />
    </span>
  );
}
