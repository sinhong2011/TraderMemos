import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("lightweight-charts", () => {
  const series = { setData: vi.fn(), createPriceLine: vi.fn() };
  const chart = {
    addSeries: vi.fn(() => series),
    applyOptions: vi.fn(),
    remove: vi.fn(),
    timeScale: () => ({ fitContent: vi.fn() }),
  };
  return {
    CandlestickSeries: {},
    ColorType: { Solid: "solid" },
    createChart: vi.fn(() => chart),
    createSeriesMarkers: vi.fn(),
  };
});

import { TradeChart } from "./TradeChart";

describe("TradeChart empty state", () => {
  it("renders an inset well with icon and message when empty", () => {
    render(
      <TradeChart
        symbol="CL1"
        bars={[]}
        fills={[]}
        interval="1"
        empty
        errorMessage="No market data for this window."
      />,
    );
    expect(screen.getByText("No market data for this window.")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /no chart data/i })).toBeInTheDocument();
  });
});
