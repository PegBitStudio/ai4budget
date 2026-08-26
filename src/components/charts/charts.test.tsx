/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";

// Chart.js needs a canvas, so the rendered chart is stubbed and the tests
// assert on the data handed to it instead.
vi.mock("react-chartjs-2", () => ({
  Bar: ({ data }: { data: unknown }) => (
    <div data-testid="bar-chart" data-chart-data={JSON.stringify(data)} />
  ),
  Line: ({ data }: { data: unknown }) => (
    <div data-testid="line-chart" data-chart-data={JSON.stringify(data)} />
  ),
}));

vi.mock("chart.js", () => ({
  Chart: { register: vi.fn() },
  CategoryScale: {},
  LinearScale: {},
  PointElement: {},
  LineElement: {},
  BarElement: {},
  ArcElement: {},
  Tooltip: {},
  Legend: {},
  Filler: {},
  Title: {},
}));

import { CategoryBreakdown } from "./CategoryBreakdown";
import { SpendingTrend } from "./SpendingTrend";

function chartData(testId: string) {
  const raw = screen.getByTestId(testId).getAttribute("data-chart-data");
  return JSON.parse(raw ?? "{}");
}

afterEach(cleanup);

describe("CategoryBreakdown", () => {
  const sample = [
    { category: "Groceries", amount: 200, percentage: 40 },
    { category: "Shopping", amount: 400, percentage: 50 },
    { category: "Transport", amount: 150, percentage: 10 },
  ];

  it("shows an empty state rather than an empty chart", () => {
    render(<CategoryBreakdown data={[]} />);
    expect(screen.getByText(/no spending recorded/i)).toBeDefined();
    expect(screen.queryByTestId("bar-chart")).toBeNull();
  });

  it("ranks categories with the largest first", () => {
    // The chart's job is "what costs me most?", so order is the whole point.
    render(<CategoryBreakdown data={sample} />);
    expect(chartData("bar-chart").labels).toEqual([
      "Shopping",
      "Groceries",
      "Transport",
    ]);
  });

  it("uses one colour for every bar", () => {
    // Bar length already encodes magnitude. Giving each bar its own hue would
    // restate that in the only free channel the chart has.
    render(<CategoryBreakdown data={sample} />);
    const [dataset] = chartData("bar-chart").datasets;
    expect(typeof dataset.backgroundColor).toBe("string");
  });

  it("survives a malformed row without blanking the page", () => {
    const malformed = [
      { category: "Groceries", amount: 200, percentage: 40 },
      // Shapes that have reached this component from the API before.
      { category: undefined, amount: 50, percentage: undefined },
      { category: "Broken", amount: Number.NaN, percentage: 10 },
    ] as unknown as Parameters<typeof CategoryBreakdown>[0]["data"];

    render(<CategoryBreakdown data={malformed} />);

    expect(chartData("bar-chart").labels).toEqual(["Groceries", "Other"]);
  });
});

describe("SpendingTrend", () => {
  const sample = [
    { period: "Jan 2024", amount: 1200 },
    { period: "Feb 2024", amount: 1400 },
    { period: "Mar 2024", amount: 1100 },
  ];

  it.each([[[]], [[{ period: "Jan", amount: 100 }]]])(
    "explains that history is still building when given %j",
    (data) => {
      render(<SpendingTrend data={data} />);
      expect(screen.getByText(/not enough history/i)).toBeDefined();
      expect(screen.queryByTestId("line-chart")).toBeNull();
    }
  );

  it("plots a single unlabelled series", () => {
    render(<SpendingTrend data={sample} />);
    const parsed = chartData("line-chart");
    expect(parsed.datasets).toHaveLength(1);
    expect(parsed.datasets[0].data).toEqual([1200, 1400, 1100]);
  });

  it("marks only the most recent point", () => {
    // The current month is what the reader is asking about; the rest of the
    // points appear on hover so the line stays clean.
    render(<SpendingTrend data={sample} />);
    const [dataset] = chartData("line-chart").datasets;
    expect(dataset.pointRadius).toEqual([0, 0, 5]);
  });
});
