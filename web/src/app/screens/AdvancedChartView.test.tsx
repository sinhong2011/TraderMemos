import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import type { BarInterval } from "@/lib/api/market";
import { AdvancedChartView } from "./AdvancedChartView";

const useMarketBarsMock = vi.fn<(...args: unknown[]) => unknown>(() => ({
  data: { bars: [] },
  isLoading: false,
  isError: false,
  error: null,
}));

vi.mock("../../lib/hooks/useMarketBars", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/hooks/useMarketBars")>();
  return {
    ...actual,
    useMarketBars: (...args: unknown[]) => useMarketBarsMock(...args),
  };
});

vi.mock("../../components/charts/TradeChart", () => ({
  TradeChart: ({ symbol, interval }: { symbol: string; interval: BarInterval }) => (
    <div data-testid="chart">
      {symbol}:{interval}
    </div>
  ),
}));

function noop() {}

describe("AdvancedChartView", () => {
  it("prompts for a symbol when none is chosen", () => {
    render(
      <AdvancedChartView symbol="" interval="D" onSymbolChange={noop} onIntervalChange={noop} />,
    );
    expect(screen.getByText("Pick a symbol")).toBeInTheDocument();
    expect(screen.queryByTestId("chart")).not.toBeInTheDocument();
  });

  it("submits the uppercased symbol", async () => {
    const onSymbolChange = vi.fn<(s: string) => void>();
    render(
      <AdvancedChartView
        symbol=""
        interval="D"
        onSymbolChange={onSymbolChange}
        onIntervalChange={noop}
      />,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Symbol"), "nvda");
    await user.click(screen.getByRole("button", { name: "Load" }));
    expect(onSymbolChange).toHaveBeenCalledWith("NVDA");
  });

  it("renders the chart for the routed symbol and interval", () => {
    render(
      <AdvancedChartView
        symbol="NVDA"
        interval="15"
        onSymbolChange={noop}
        onIntervalChange={noop}
      />,
    );
    expect(screen.getByTestId("chart")).toHaveTextContent("NVDA:15");
    const call = useMarketBarsMock.mock.calls.at(-1)?.[0] as { enabled: boolean; symbol: string };
    expect(call.symbol).toBe("NVDA");
    expect(call.enabled).toBe(true);
  });
});
