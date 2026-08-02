import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { Execution } from "@/lib/api/types";
import type { MarketBar } from "@/lib/api/market";

const setData = vi.fn<(...args: any[]) => any>();
const setMarkers = vi.fn<(...args: any[]) => any>();
const createSeriesMarkers = vi.fn<(...args: any[]) => any>(() => ({ setMarkers }));

vi.mock("lightweight-charts", () => {
  const series = {
    setData: (...args: any[]) => setData(...args),
    createPriceLine: vi.fn<(...args: any[]) => any>(),
    priceLines: () => [],
    removePriceLine: vi.fn<(...args: any[]) => any>(),
  };
  const chart = {
    addSeries: vi.fn<(...args: any[]) => any>(() => series),
    applyOptions: vi.fn<(...args: any[]) => any>(),
    remove: vi.fn<(...args: any[]) => any>(),
    timeScale: () => ({ fitContent: vi.fn<(...args: any[]) => any>() }),
  };
  return {
    CandlestickSeries: {},
    ColorType: { Solid: "solid" },
    createChart: vi.fn<(...args: any[]) => any>(() => chart),
    createSeriesMarkers: (...args: any[]) => createSeriesMarkers(...args),
  };
});

import { TradeChart } from "./TradeChart";

const T0 = 1_752_600_000;

function bar(time: number, close: number): MarketBar {
  return { time, open: close, high: close, low: close, close, volume: 0 };
}

const bars = [bar(T0, 10), bar(T0 + 60, 11), bar(T0 + 120, 12)];

const fills: Execution[] = [
  {
    id: "e1",
    user_id: "u1",
    account_id: "a1",
    external_id: null,
    symbol: "AAPL",
    instrument_type: "stock",
    side: "buy",
    quantity: 100,
    price: 11,
    fees: 0,
    commission: 0,
    executed_at: new Date((T0 + 60) * 1000).toISOString(),
    multiplier: 1,
    details: null,
    import_batch_id: null,
    dedup_hash: "h",
    created_at: new Date((T0 + 60) * 1000).toISOString(),
  },
];

describe("TradeChart replay mode", () => {
  beforeEach(() => {
    setData.mockClear();
    setMarkers.mockClear();
    createSeriesMarkers.mockClear();
  });

  it("whitespaces bars past the cursor and hides not-yet-passed fill markers", () => {
    render(
      <TradeChart symbol="AAPL" bars={bars} fills={fills} interval="1" replayUpTo={T0 + 60} />,
    );
    const points = setData.mock.calls.at(-1)![0];
    expect(points).toHaveLength(3);
    expect(points[0]).toHaveProperty("open");
    expect(points[1]).not.toHaveProperty("open");
    expect(points[2]).not.toHaveProperty("open");
    // The only fill sits in the second bar, which the cursor hasn't reached.
    expect(createSeriesMarkers).not.toHaveBeenCalled();
  });

  it("reveals candles and markers once the cursor passes them", () => {
    render(
      <TradeChart symbol="AAPL" bars={bars} fills={fills} interval="1" replayUpTo={T0 + 180} />,
    );
    const points = setData.mock.calls.at(-1)![0];
    expect(points[2]).toHaveProperty("open");
    expect(createSeriesMarkers).toHaveBeenCalledTimes(1);
    expect(createSeriesMarkers.mock.calls[0]![1]).toHaveLength(1);
  });

  it("shows all candles when replay is off", () => {
    render(<TradeChart symbol="AAPL" bars={bars} fills={[]} interval="1" />);
    const points = setData.mock.calls.at(-1)![0];
    expect(points.every((p: object) => "open" in p)).toBe(true);
  });

  it("renders the replay toggle with a state-dependent label", () => {
    const { getByLabelText, rerender } = render(
      <TradeChart symbol="AAPL" bars={bars} fills={[]} interval="1" onToggleReplay={() => {}} />,
    );
    expect(getByLabelText("Replay trade")).toBeInTheDocument();
    rerender(
      <TradeChart
        symbol="AAPL"
        bars={bars}
        fills={[]}
        interval="1"
        onToggleReplay={() => {}}
        replayActive
        replayUpTo={T0 + 60}
      />,
    );
    expect(getByLabelText("Exit replay")).toBeInTheDocument();
  });
});
