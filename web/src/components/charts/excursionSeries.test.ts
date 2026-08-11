import { describe, expect, it } from "vite-plus/test";
import type { MarketBar } from "@/lib/api/market";
import type { Execution } from "@/lib/api/types";
import { computeExcursionSeries, trimBarsToHold } from "./excursionSeries";

const T0 = 1_752_600_000; // arbitrary recent unix second, minute-aligned

function fill(overrides: Partial<Execution>): Execution {
  return {
    id: "e1",
    user_id: "u1",
    account_id: "a1",
    external_id: null,
    symbol: "AAPL",
    instrument_type: "stock",
    side: "buy",
    quantity: 100,
    price: 10,
    fees: 0,
    commission: 0,
    executed_at: new Date(T0 * 1000).toISOString(),
    multiplier: 1,
    details: null,
    import_batch_id: null,
    dedup_hash: "h",
    created_at: new Date(T0 * 1000).toISOString(),
    ...overrides,
  };
}

function bar(time: number, close: number, high = close, low = close): MarketBar {
  return { time, open: close, high, low, close, volume: 0 };
}

const at = (sec: number) => new Date(sec * 1000).toISOString();

describe("trimBarsToHold", () => {
  it("keeps the holding window plus one bar of context and drops strays", () => {
    const bars = [
      bar(T0 - 1800, 9), // server padding, before the hold
      bar(T0 - 60, 10),
      bar(T0, 10),
      bar(T0 + 60, 11),
      bar(T0 + 120, 11),
      bar(T0 + 86400, 14), // stray bar days later
    ];
    const trimmed = trimBarsToHold(bars, "1", at(T0), at(T0 + 90));
    expect(trimmed.map((b) => b.time)).toEqual([T0 - 60, T0, T0 + 60, T0 + 120]);
  });
});

describe("computeExcursionSeries", () => {
  it("marks the open long to each bar close, starting from zero", () => {
    const bars = [bar(T0, 10), bar(T0 + 60, 11), bar(T0 + 120, 12)];
    const fills = [fill({ executed_at: at(T0), price: 10, quantity: 100 })];
    const s = computeExcursionSeries(fills, bars, "1")!;
    expect(s.points.map((p) => p.equity)).toEqual([0, 100, 200]);
    expect(s.points.map((p) => p.time)).toEqual([T0, T0 + 60, T0 + 120]);
  });

  it("takes the envelope from bar highs/lows, not just closes", () => {
    const bars = [bar(T0, 10), bar(T0 + 60, 10.5, 13, 8), bar(T0 + 120, 11)];
    const fills = [fill({ executed_at: at(T0), price: 10, quantity: 100 })];
    const s = computeExcursionSeries(fills, bars, "1")!;
    expect(s.mfe).toBe(300); // (13 - 10) * 100
    expect(s.mae).toBe(200); // (10 - 8) * 100
    // The close-marked curve never reaches the wick extremes.
    expect(Math.max(...s.points.map((p) => p.equity))).toBe(100);
  });

  it("probes equity at fill prices (an exit above every close counts)", () => {
    const bars = [bar(T0, 10), bar(T0 + 60, 11), bar(T0 + 120, 10)];
    const fills = [
      fill({ executed_at: at(T0), price: 10, quantity: 100 }),
      fill({ id: "e2", executed_at: at(T0 + 130), side: "sell", price: 11.5, quantity: 100 }),
    ];
    const s = computeExcursionSeries(fills, bars, "1")!;
    expect(s.mfe).toBe(150); // realized at the exit fill price
    // After the flat exit the curve holds the realized result.
    expect(s.points[2]!.equity).toBe(150);
  });

  it("is gross: fees and commission never touch the curve", () => {
    const bars = [bar(T0, 10), bar(T0 + 60, 12)];
    const fills = [fill({ executed_at: at(T0), price: 10, quantity: 100, fees: 5, commission: 7 })];
    const s = computeExcursionSeries(fills, bars, "1")!;
    expect(s.points[1]!.equity).toBe(200);
  });

  it("handles shorts: equity rises as price falls", () => {
    const bars = [bar(T0, 12), bar(T0 + 60, 11), bar(T0 + 120, 13)];
    const fills = [fill({ executed_at: at(T0), side: "sell", price: 12, quantity: 50 })];
    const s = computeExcursionSeries(fills, bars, "1")!;
    expect(s.points.map((p) => p.equity)).toEqual([0, 50, -50]);
    expect(s.mfe).toBe(50);
    expect(s.mae).toBe(50);
  });

  it("applies the contract multiplier", () => {
    const bars = [bar(T0, 10), bar(T0 + 60, 12)];
    const fills = [fill({ executed_at: at(T0), price: 10, quantity: 2, multiplier: 50 })];
    const s = computeExcursionSeries(fills, bars, "1")!;
    expect(s.points[1]!.equity).toBe(200); // (12 - 10) * 2 * 50
  });

  it("keeps equity flat at zero on bars before the first fill", () => {
    const bars = [bar(T0, 9, 15, 5), bar(T0 + 60, 10), bar(T0 + 120, 11)];
    const fills = [fill({ executed_at: at(T0 + 60), price: 10, quantity: 100 })];
    const s = computeExcursionSeries(fills, bars, "1")!;
    expect(s.points[0]!.equity).toBe(0);
    // The wild pre-entry bar must not pollute the envelope.
    expect(s.mfe).toBe(100); // (11 - 10) * 100
    expect(s.mae).toBe(0);
  });

  it("settles an exit beyond the last bar at the realized result", () => {
    const bars = [bar(T0, 10), bar(T0 + 60, 11)];
    const fills = [
      fill({ executed_at: at(T0), price: 10, quantity: 100 }),
      // After-hours exit, past the tape's last bar.
      fill({ id: "e2", executed_at: at(T0 + 600), side: "sell", price: 12, quantity: 100 }),
    ];
    const s = computeExcursionSeries(fills, bars, "1")!;
    expect(s.points).toHaveLength(3);
    expect(s.points[2]!).toEqual({ time: T0 + 120, equity: 200 });
    expect(s.mfe).toBe(200);
  });

  it("returns null when there is nothing to draw", () => {
    const bars = [bar(T0, 10), bar(T0 + 60, 11)];
    expect(computeExcursionSeries([], bars, "1")).toBeNull();
    expect(computeExcursionSeries([fill({})], [bar(T0, 10)], "1")).toBeNull();
    // All fills after the chart window.
    const late = [fill({ executed_at: at(T0 + 600) })];
    expect(computeExcursionSeries(late, bars, "1")).toBeNull();
  });
});
