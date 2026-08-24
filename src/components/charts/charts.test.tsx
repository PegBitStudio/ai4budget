/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";

// Mock react-chartjs-2 to avoid canvas/DOM issues in tests
vi.mock("react-chartjs-2", () => ({
  Doughnut: ({ data }: { data: unknown }) => (
    <div data-testid="doughnut-chart" data-chart-data={JSON.stringify(data)} />
  ),
  Line: ({ data }: { data: unknown }) => (
    <div data-testid="line-chart" data-chart-data={JSON.stringify(data)} />
  ),
}));

// Mock chart.js registration
vi.mock("chart.js", () => ({
  Chart: { register: vi.fn() },
  CategoryScale: {},
  LinearScale: {},
  PointElement: {},
  LineElement: {},
  ArcElement: {},
  Tooltip: {},
  Legend: {},
  Filler: {},
  Title: {},
}));

import { CategoryBreakdown } from "./CategoryBreakdown";
import { SpendingTrend } from "./SpendingTrend";

describe("CategoryBreakdown", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1024,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("shows empty state when data is empty", () => {
    render(<CategoryBreakdown data={[]} />);
    expect(screen.getByText("No spending data available")).toBeDefined();
    expect(screen.queryByTestId("doughnut-chart")).toBeNull();
  });

  it("renders doughnut chart when data is provided", () => {
    const data = [
      { category: "Groceries", amount: 200, percentage: 40 },
      { category: "Transport", amount: 150, percentage: 30 },
      { category: "Entertainment", amount: 150, percentage: 30 },
    ];
    render(<CategoryBreakdown data={data} />);
    expect(screen.getByTestId("doughnut-chart")).toBeDefined();
    expect(screen.queryByText("No spending data available")).toBeNull();
  });
});

describe("SpendingTrend", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows empty state when fewer than 2 data points", () => {
    render(<SpendingTrend data={[{ period: "Jan", amount: 100 }]} />);
    expect(screen.getByText("Not enough data for trend")).toBeDefined();
    expect(screen.queryByTestId("line-chart")).toBeNull();
  });

  it("shows empty state when data is empty", () => {
    render(<SpendingTrend data={[]} />);
    expect(screen.getByText("Not enough data for trend")).toBeDefined();
    expect(screen.queryByTestId("line-chart")).toBeNull();
  });

  it("renders line chart when 2+ data points provided", () => {
    const data = [
      { period: "Jan 2024", amount: 1200 },
      { period: "Feb 2024", amount: 1400 },
      { period: "Mar 2024", amount: 1100 },
    ];
    render(<SpendingTrend data={data} />);
    expect(screen.getByTestId("line-chart")).toBeDefined();
    expect(screen.queryByText("Not enough data for trend")).toBeNull();
  });
});
