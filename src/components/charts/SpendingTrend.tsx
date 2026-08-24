"use client";

import "./ChartRegistration";
import { Line } from "react-chartjs-2";
import type { ChartOptions } from "chart.js";
import { formatCurrency } from "@/utils/formatters";

export interface SpendingTrendData {
  period: string;
  amount: number;
}

interface SpendingTrendProps {
  data: SpendingTrendData[];
}

export function SpendingTrend({ data }: SpendingTrendProps) {
  if (data.length < 2) {
    return (
      <div className="h-[250px] sm:h-[300px] md:h-[400px] w-full flex items-center justify-center text-gray-500">
        Not enough data for trend
      </div>
    );
  }

  const chartData = {
    labels: data.map((item) => item.period),
    datasets: [
      {
        label: "Total Spending",
        data: data.map((item) => item.amount),
        borderColor: "#3B82F6",
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        fill: true,
        tension: 0.3,
        pointBackgroundColor: "#3B82F6",
        pointBorderColor: "#3B82F6",
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label(context) {
            const value = context.parsed?.y ?? 0;
            return `Spending: ${formatCurrency(value)}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          callback(value) {
            return formatCurrency(Number(value));
          },
        },
      },
    },
  };

  return (
    <div className="h-[250px] sm:h-[300px] md:h-[400px] w-full">
      <Line data={chartData} options={options} />
    </div>
  );
}
