import { describe, expect, it } from "vite-plus/test";
import type { Execution } from "@/lib/api/types";
import type { MarketBar } from "@/lib/api/market";
import {
  computeReplayPnl,
  detectFillBarMismatch,
  formatReplayBarTime,
  replayCutoff,
} from "./replayPnl";

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

function bar(time: number, close: number): MarketBar {
  return { time, open: close, high: close, low: close, close, volume: 0 };
}

// One-minute bars starting at T0.
const bars: MarketBar[] = [bar(T0, 10), bar(T0 + 60, 11), bar(T0 + 120, 12), bar(T0 + 180, 9)];

const at = (sec: number) => new Date(sec * 1000).toISOString();

describe("computeReplayPnl", () => {
  it("is flat with zero P&L before any fill has happened", () => {
    const fills = [fill({ executed_at: at(T0 + 120) })];
    const pnl = computeReplayPnl(fills, bars, 0, "1")!;
    expect(pnl.position).toBe(0);
    expect(pnl.net).toBe(0);
    expect(pnl.fillCount).toBe(0);
  });

  it("marks an open long to the cursor bar close", () => {
    const fills = [fill({ executed_at: at(T0), price: 10, quantity: 100 })];
    const pnl = computeReplayPnl(fills, bars, 2, "1")!;
    expect(pnl.position).toBe(100);
    expect(pnl.avgCost).toBe(10);
    expect(pnl.unrealized).toBe(200); // (12 - 10) * 100
    expect(pnl.net).toBe(200);
  });

  it("counts a fill inside the cursor bar (cutoff is exclusive of next open)", () => {
    const fills = [fill({ executed_at: at(T0 + 30) })];
    expect(computeReplayPnl(fills, bars, 0, "1")!.fillCount).toBe(1);
    // A fill stamped exactly at the next bar open belongs to the next bar.
    const nextOpen = [fill({ executed_at: at(T0 + 60) })];
    expect(computeReplayPnl(nextOpen, bars, 0, "1")!.fillCount).toBe(0);
    expect(computeReplayPnl(nextOpen, bars, 1, "1")!.fillCount).toBe(1);
  });

  it("realizes P&L on a partial exit and keeps avg cost on the remainder", () => {
    const fills = [
      fill({ executed_at: at(T0), price: 10, quantity: 100 }),
      fill({ id: "e2", executed_at: at(T0 + 60), side: "sell", price: 11, quantity: 40 }),
    ];
    const pnl = computeReplayPnl(fills, bars, 2, "1")!;
    expect(pnl.position).toBe(60);
    expect(pnl.realized).toBe(40); // (11 - 10) * 40
    expect(pnl.unrealized).toBe(120); // (12 - 10) * 60
    expect(pnl.net).toBe(160);
  });

  it("blends avg cost on a scale-in", () => {
    const fills = [
      fill({ executed_at: at(T0), price: 10, quantity: 100 }),
      fill({ id: "e2", executed_at: at(T0 + 60), price: 12, quantity: 100 }),
    ];
    const pnl = computeReplayPnl(fills, bars, 2, "1")!;
    expect(pnl.position).toBe(200);
    expect(pnl.avgCost).toBe(11);
    expect(pnl.unrealized).toBe(200); // (12 - 11) * 200
  });

  it("handles shorts: profit when price falls", () => {
    const fills = [fill({ executed_at: at(T0), side: "sell", price: 12, quantity: 50 })];
    const pnl = computeReplayPnl(fills, bars, 3, "1")!;
    expect(pnl.position).toBe(-50);
    expect(pnl.unrealized).toBe(150); // (9 - 12) * -50
  });

  it("re-opens at the flip price when a fill crosses through flat", () => {
    const fills = [
      fill({ executed_at: at(T0), price: 10, quantity: 100 }),
      fill({ id: "e2", executed_at: at(T0 + 60), side: "sell", price: 11, quantity: 150 }),
    ];
    const pnl = computeReplayPnl(fills, bars, 2, "1")!;
    expect(pnl.position).toBe(-50);
    expect(pnl.realized).toBe(100); // (11 - 10) * 100
    expect(pnl.avgCost).toBe(11);
    expect(pnl.unrealized).toBe(-50); // (12 - 11) * -50
  });

  it("subtracts fees and commission and applies the contract multiplier", () => {
    const fills = [
      fill({ executed_at: at(T0), price: 10, quantity: 2, multiplier: 50, fees: 1, commission: 2 }),
    ];
    const pnl = computeReplayPnl(fills, bars, 2, "1")!;
    expect(pnl.unrealized).toBe(200); // (12 - 10) * 2 * 50
    expect(pnl.fees).toBe(3);
    expect(pnl.net).toBe(197);
  });

  it("returns null when the cursor is out of range", () => {
    expect(computeReplayPnl([], bars, 99, "1")).toBeNull();
  });
});

describe("replayCutoff", () => {
  it("is the cursor bar open plus one interval", () => {
    expect(replayCutoff(bars, 1, "1")).toBe(T0 + 120);
    expect(replayCutoff(bars, 0, "5")).toBe(T0 + 300);
  });
});

describe("detectFillBarMismatch", () => {
  it("accepts fills at or near their containing bar's prices", () => {
    expect(detectFillBarMismatch([fill({ executed_at: at(T0), price: 10 })], bars, "1")).toBe(
      false,
    );
    // Within the 1% slack around the bar range.
    expect(detectFillBarMismatch([fill({ executed_at: at(T0), price: 10.05 })], bars, "1")).toBe(
      false,
    );
  });

  it("flags a fill priced far outside its containing bar", () => {
    expect(detectFillBarMismatch([fill({ executed_at: at(T0), price: 12 })], bars, "1")).toBe(true);
    expect(detectFillBarMismatch([fill({ executed_at: at(T0 + 90), price: 8.5 })], bars, "1")).toBe(
      true,
    );
  });

  it("ignores fills outside the chart window", () => {
    expect(detectFillBarMismatch([fill({ executed_at: at(T0 - 600), price: 99 })], bars, "1")).toBe(
      false,
    );
  });
});

describe("formatReplayBarTime", () => {
  it("includes the clock time for intraday intervals but not daily", () => {
    const intraday = formatReplayBarTime(T0, "5", "en-US");
    expect(intraday).toMatch(/\d{2}:\d{2}/);
    const daily = formatReplayBarTime(T0, "D", "en-US");
    expect(daily).not.toMatch(/\d{2}:\d{2}/);
  });
});
