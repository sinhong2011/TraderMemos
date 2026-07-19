import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { ReportsRDistributionChart } from "./ReportsRDistributionChart";

// Recharts' ResponsiveContainer measures its container via getBoundingClientRect
// on mount, and its axis-tick text wrapping measures each word the same way via
// a hidden `#recharts_measurement_span`. jsdom always reports 0x0 for both, so
// without a non-zero container size the chart never renders, and without a
// content-proportional span size every tick word appears to overflow and gets
// wrapped onto its own line. Fake both cases so ticks render as single lines.
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      if (this.id === "recharts_measurement_span") {
        const width = (this.textContent ?? "").length * 6;
        return {
          width,
          height: 12,
          top: 0,
          left: 0,
          bottom: 12,
          right: width,
          x: 0,
          y: 0,
          toJSON: () => {},
        } as DOMRect;
      }
      return {
        width: 600,
        height: 200,
        top: 0,
        left: 0,
        bottom: 200,
        right: 600,
        x: 0,
        y: 0,
        toJSON: () => {},
      } as DOMRect;
    },
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ReportsRDistributionChart", () => {
  it("renders bucket labels", () => {
    render(
      <ReportsRDistributionChart
        distribution={[
          { label: "-1 to 0", count: 2, from: -1, to: 0 },
          { label: "0 to +1", count: 4, from: 0, to: 1 },
        ]}
        avgR={1.05}
        totalTrades={18}
        excluded={9}
        loading={false}
        error={false}
      />,
    );
    expect(screen.getByText("-1 to 0")).toBeInTheDocument();
    // totalTrades (18) is the R-eligible/included count; excluded (9) is
    // disjoint, so the caption's denominator is their sum, not totalTrades.
    expect(screen.getByText(/Showing 18 of 27 closed trades, 9 excluded/)).toBeInTheDocument();
  });

  it("shows an empty state with no distribution data", () => {
    render(
      <ReportsRDistributionChart
        distribution={[]}
        avgR={0}
        totalTrades={0}
        excluded={0}
        loading={false}
        error={false}
      />,
    );
    expect(screen.getByText("No R data")).toBeInTheDocument();
  });
});
