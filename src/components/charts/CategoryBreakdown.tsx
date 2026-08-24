"use client";

import "./ChartRegistration";
import { Doughnut } from "react-chartjs-2";
import { CATEGORY_COLORS } from "@/config/categories";
import type { Category } from "@/models/category";
import type { ChartOptions } from "chart.js";
import { useState, useEffect } from "react";
import { formatCurrency } from "@/utils/formatters";

export interface CategoryBreakdownData {
  category: string;
  amount: number;
  percentage: number;
}

interface CategoryBreakdownProps {
  data: CategoryBreakdownData[];
}

export function CategoryBreakdown({ data }: CategoryBreakdownProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  if (data.length === 0) {
    return (
      <div className="h-[250px] sm:h-[300px] md:h-[400px] w-full flex items-center justify-center text-gray-500">
        No spending data available
      </div>
    );
  }

  const backgroundColors = data.map(
    (item) =>
      CATEGORY_COLORS[item.category as Category] || CATEGORY_COLORS.Other
  );

  const chartData = {
    labels: data.map(
      (item) => `${item.category} (${formatCurrency(item.amount)} · ${item.percentage.toFixed(1)}%)`
    ),
    datasets: [
      {
        data: data.map((item) => item.amount),
        backgroundColor: backgroundColors,
        borderColor: backgroundColors.map((c) => c),
        borderWidth: 1,
      },
    ],
  };

  const options: ChartOptions<"doughnut"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: isMobile ? "bottom" : "right",
        labels: {
          boxWidth: 12,
          padding: 8,
        },
      },
      tooltip: {
        callbacks: {
          label(context) {
            const item = data[context.dataIndex];
            return `${item.category}: ${formatCurrency(item.amount)} (${item.percentage.toFixed(1)}%)`;
          },
        },
      },
    },
  };

  return (
    <div className="h-[250px] sm:h-[300px] md:h-[400px] w-full">
      <Doughnut data={chartData} options={options} />
    </div>
  );
}
