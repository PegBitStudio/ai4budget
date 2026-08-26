import type { ChartOptions, TooltipOptions } from "chart.js";

/**
 * Shared chart styling.
 *
 * Both charts here plot a single series, which settles most of the colour
 * question: bar length and line position already encode magnitude, so giving
 * each bar its own hue would spend the only free channel restating what the
 * chart already shows. One hue for every mark, and the axes recede.
 *
 * Jade is that hue. It is the product's accent, it clears 3:1 against the card
 * surface, and it sits inside the readable lightness band — a near-black mark
 * passes contrast too but reads as an absence of colour across a whole panel.
 */
export const CHART_COLORS = {
  mark: "#0e7c66",
  markSoft: "rgba(14, 124, 102, 0.12)",
  markHover: "#0b5c4c",
  grid: "#eef0ef",
  axisText: "#6b7578",
  tooltipBg: "#14181a",
  tooltipText: "#ffffff",
  tooltipMuted: "#949c9e",
} as const;

const FONT_FAMILY =
  'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';

/**
 * A dark, compact tooltip rather than Chart.js's default. Values are the point
 * of a financial chart, so the tooltip is where precision lives — the axes only
 * need to give shape.
 */
export const TOOLTIP_STYLE: Partial<TooltipOptions> = {
  backgroundColor: CHART_COLORS.tooltipBg,
  titleColor: CHART_COLORS.tooltipMuted,
  bodyColor: CHART_COLORS.tooltipText,
  titleFont: { family: FONT_FAMILY, size: 11, weight: 600 },
  bodyFont: { family: FONT_FAMILY, size: 13, weight: 600 },
  padding: 10,
  cornerRadius: 6,
  displayColors: false,
  borderWidth: 0,
};

export const AXIS_TICK_FONT = {
  family: FONT_FAMILY,
  size: 11,
} as const;

/** Animation that draws the data in once, and is skipped when motion is reduced. */
export function chartAnimation(): ChartOptions["animation"] {
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  if (reduced) {
    return false;
  }

  return { duration: 600, easing: "easeOutQuart" };
}
