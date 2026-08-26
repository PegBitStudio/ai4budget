"use client";

import "./ChartRegistration";
import { Line } from "react-chartjs-2";
import type { ChartOptions } from "chart.js";
import { formatCurrency } from "@/utils/formatters";
import {
  CHART_COLORS,
  TOOLTIP_STYLE,
  AXIS_TICK_FONT,
  chartAnimation,
} from "./chartTheme";

export interface SpendingTrendData {
  period: string;
  amount: number;
}

interface SpendingTrendProps {
  data: SpendingTrendData[];
}

/**
 * Total spending per month.
 *
 * A single series, so no legend and one hue. Points are hidden until hovered
 * except the most recent — the current month is the one the reader is actually
 * asking about, so it stays marked.
 */
export function SpendingTrend({ data }: SpendingTrendProps) {
  if (data.length < 2) {
    return (
      <div className="flex h-[260px] w-full items-center justify-center text-body text-ink-500">
        Not enough history yet — this fills in as the months pass
      </div>
    );
  }

  const lastIndex = data.length - 1;

  const chartData = {
    labels: data.map((item) => item.period),
    datasets: [
      {
        label: "Spending",
        data: data.map((item) => item.amount),
        borderColor: CHART_COLORS.mark,
        backgroundColor: CHART_COLORS.markSoft,
        borderWidth: 2,
        fill: true,
        tension: 0.35,
        pointBackgroundColor: CHART_COLORS.mark,
        pointBorderColor: "#ffffff",
        pointBorderWidth: 2,
        // Only the latest point is marked; the rest appear on hover.
        pointRadius: data.map((_, i) => (i === lastIndex ? 5 : 0)),
        pointHoverRadius: 5,
        pointHitRadius: 16,
      },
    ],
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: chartAnimation() as ChartOptions<"line">["animation"],
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...TOOLTIP_STYLE,
        callbacks: {
          title: (items) => String(items[0]?.label ?? ""),
          label: (context) => formatCurrency(context.parsed?.y ?? 0),
        },
      },
    },
    scales: {
      x: {
        border: { display: false },
        grid: { display: false },
        ticks: { color: CHART_COLORS.axisText, font: AXIS_TICK_FONT },
      },
      y: {
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
    },
  };

  return (
    <div className="h-[260px] w-full">
      <Line data={chartData} options={options} />
    </div>
  );
}

function compactNaira(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `₦${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `₦${Math.round(value / 1_000)}k`;
  return `₦${value}`;
}
