"use client";

import "./ChartRegistration";
import { Bar } from "react-chartjs-2";
import type { ChartOptions } from "chart.js";
import { formatCurrency } from "@/utils/formatters";
import {
  CHART_COLORS,
  TOOLTIP_STYLE,
  AXIS_TICK_FONT,
  chartAnimation,
} from "./chartTheme";

export interface CategoryBreakdownData {
  category: string;
  amount: number;
  percentage: number;
}

interface CategoryBreakdownProps {
  data: CategoryBreakdownData[];
}

/**
 * Spending by category, as a ranked horizontal bar chart.
 *
 * This was a ten-slice doughnut. A doughnut asks the reader to compare angles,
 * which people are poor at, and ten slices needed ten hues — past roughly seven
 * colour classes adjacent ones blur together regardless of how they are chosen.
 * Ranked bars answer the actual question ("what costs me most?") by putting the
 * largest bar at the top and letting length do the work.
 *
 * Horizontal because the category names are words, and words fit along a
 * horizontal axis without being turned on their side.
 */
export function CategoryBreakdown({ data: rawData }: CategoryBreakdownProps) {
  // Guard against malformed rows so a bad payload can never blank the page.
  const data = (rawData ?? [])
    .filter((item) => item && Number.isFinite(item.amount))
    .map((item) => ({
      category: item.category ?? "Other",
      amount: item.amount,
      percentage: Number.isFinite(item.percentage) ? item.percentage : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  if (data.length === 0) {
    return (
      <div className="flex h-[260px] w-full items-center justify-center text-body text-ink-500">
        No spending recorded yet
      </div>
    );
  }

  const chartData = {
    labels: data.map((item) => item.category),
    datasets: [
      {
        label: "Spent",
        data: data.map((item) => item.amount),
        backgroundColor: CHART_COLORS.mark,
        hoverBackgroundColor: CHART_COLORS.markHover,
        // Rounded only at the data end, anchored to the baseline.
        borderRadius: { topLeft: 0, bottomLeft: 0, topRight: 4, bottomRight: 4 },
        borderSkipped: false as const,
        barThickness: 14,
        maxBarThickness: 18,
      },
    ],
  };

  const options: ChartOptions<"bar"> = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    animation: chartAnimation() as ChartOptions<"bar">["animation"],
    layout: { padding: { right: 8 } },
    plugins: {
      // One series — the panel heading already names it.
      legend: { display: false },
      tooltip: {
        ...TOOLTIP_STYLE,
        callbacks: {
          title: (items) => String(items[0]?.label ?? ""),
          label: (context) => {
            const item = data[context.dataIndex];
            return `${formatCurrency(item.amount)} · ${item.percentage.toFixed(1)}% of spending`;
          },
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        border: { display: false },
        grid: { color: CHART_COLORS.grid },
        ticks: {
          color: CHART_COLORS.axisText,
          font: AXIS_TICK_FONT,
          maxTicksLimit: 5,
          callback: (value) => compactNaira(Number(value)),
        },
      },
      y: {
        border: { display: false },
        grid: { display: false },
        ticks: { color: CHART_COLORS.axisText, font: AXIS_TICK_FONT },
      },
    },
  };

  // Height follows the row count so bars keep a consistent thickness whether
  // there are three categories or ten.
  const height = Math.max(200, data.length * 30 + 48);

  return (
    <div className="w-full" style={{ height }}>
      <Bar data={chartData} options={options} />
    </div>
  );
}

/** Axis ticks only need magnitude — the tooltip carries the exact figure. */
function compactNaira(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `₦${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `₦${Math.round(value / 1_000)}k`;
  return `₦${value}`;
}
