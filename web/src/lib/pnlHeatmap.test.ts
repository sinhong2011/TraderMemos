import { describe, expect, it } from "vite-plus/test";
import type { Trade } from "./api/types";
import { computePnlHeatmap, HEATMAP_DAY_LABELS } from "./pnlHeatmap";

const ET = "America/New_York";

function trade(over: Partial<Trade>): Trade {
  return {
    id: "t1",
    account_id: "a1",
    symbol: "NQ",
    instrument_type: "future",
    direction: "long",
    status: "closed",
    opened_at: "2026-01-05T15:30:00Z",
    closed_at: "2026-01-05T16:00:00Z",
    qty_opened: 1,
    qty_remaining: 0,
    avg_entry_price: 100,
    avg_exit_price: 110,
    gross_pnl: 10,
    fees_total: 0,
    net_pnl: 10,
    pnl_currency: "USD",
    return_pct: 0.1,
    time_in_trade_secs: 1800,
    notes: "",
    tags: [],
    ...over,
  };
}

describe("computePnlHeatmap", () => {
  it("buckets by entry weekday and hour on the market clock", () => {
    // 2026-01-05 is a Monday; 15:30Z is 10:30 ET (winter, UTC-5).
    const h = computePnlHeatmap([trade({ net_pnl: 100 })], ET);
    expect(h.grid[0][10]).toEqual({ pnl: 100, trades: 1 });
    expect(h.days).toEqual([0]);
    expect(h.hourStart).toBe(10);
    expect(h.hourEnd).toBe(10);
    expect(HEATMAP_DAY_LABELS[0]).toBe("Mon");
  });

  it("respects daylight saving — summer UTC offsets shift the hour", () => {
    // 2026-07-06 is a Monday; 13:30Z is 09:30 ET (summer, UTC-4).
    const h = computePnlHeatmap([trade({ opened_at: "2026-07-06T13:30:00Z" })], ET);
    expect(h.grid[0][9].trades).toBe(1);
  });

  it("aggregates cells and tracks the absolute max", () => {
    const h = computePnlHeatmap(
      [
        trade({ id: "1", net_pnl: 100 }),
        trade({ id: "2", net_pnl: 50 }),
        trade({ id: "3", opened_at: "2026-01-06T15:30:00Z", net_pnl: -400 }),
      ],
      ET,
    );
    expect(h.grid[0][10]).toEqual({ pnl: 150, trades: 2 });
    expect(h.grid[1][10]).toEqual({ pnl: -400, trades: 1 });
    expect(h.maxAbsPnl).toBe(400);
    expect(h.total).toBe(3);
    expect(h.days).toEqual([0, 1]);
  });

  it("skips open trades and defaults the hour range when empty", () => {
    const h = computePnlHeatmap([trade({ status: "open", closed_at: null })], ET);
    expect(h.total).toBe(0);
    expect(h.hourStart).toBe(9);
    expect(h.hourEnd).toBe(16);
  });
});
