import { describe, expect, it } from "vite-plus/test";
import type { EquityPoint, Trade } from "./api/types";
import { chartRangeCutoff, equityPointsInRange, tradesInRange } from "./chartRange";

const DAY = 86_400_000;

function trade(over: Partial<Trade>): Trade {
  return {
    id: "t1",
    account_id: "a1",
    symbol: "NQ",
    instrument_type: "future",
    direction: "long",
    status: "closed",
    opened_at: "2026-03-30T10:00:00Z",
    closed_at: "2026-03-30T11:00:00Z",
    qty_opened: 1,
    qty_remaining: 0,
    avg_entry_price: 100,
    avg_exit_price: 110,
    gross_pnl: 10,
    fees_total: 0,
    net_pnl: 10,
    pnl_currency: "USD",
    return_pct: 0.1,
    time_in_trade_secs: 3600,
    notes: "",
    tags: [],
    ...over,
  };
}

describe("chartRangeCutoff", () => {
  it("is null for the all range", () => {
    expect(chartRangeCutoff("all", Date.UTC(2026, 2, 30))).toBeNull();
  });

  it("counts back from the anchor, not the wall clock", () => {
    const anchor = Date.UTC(2026, 2, 30);
    expect(chartRangeCutoff("1m", anchor)).toBe(anchor - 30 * DAY);
    expect(chartRangeCutoff("1y", anchor)).toBe(anchor - 365 * DAY);
  });
});

describe("tradesInRange", () => {
  const recent = trade({ id: "recent" });
  const midWinter = trade({ id: "mid", closed_at: "2026-01-15T11:00:00Z" });
  const lastYear = trade({ id: "old", closed_at: "2025-02-01T11:00:00Z" });
  const all = [recent, midWinter, lastYear];

  it("returns the input untouched for all", () => {
    expect(tradesInRange(all, "all")).toBe(all);
  });

  it("anchors the window at the newest trade so it composes with a past global filter", () => {
    expect(tradesInRange(all, "1m").map((t) => t.id)).toEqual(["recent"]);
    expect(tradesInRange(all, "3m").map((t) => t.id)).toEqual(["recent", "mid"]);
    expect(tradesInRange(all, "1y").map((t) => t.id)).toEqual(["recent", "mid"]);
  });

  it("falls back to opened_at for open trades", () => {
    const open = trade({
      id: "open",
      status: "open",
      closed_at: null,
      opened_at: "2026-03-29T10:00:00Z",
    });
    const oldOpen = trade({
      id: "old-open",
      status: "open",
      closed_at: null,
      opened_at: "2025-06-01T10:00:00Z",
    });
    expect(tradesInRange([recent, open, oldOpen], "1m").map((t) => t.id)).toEqual([
      "recent",
      "open",
    ]);
  });

  it("handles an empty list", () => {
    expect(tradesInRange([], "1m")).toEqual([]);
  });
});

describe("equityPointsInRange", () => {
  const points: EquityPoint[] = [
    { at: "2025-06-01T00:00:00Z", equity: 1000 },
    { at: "2026-01-15T00:00:00Z", equity: 1200 },
    { at: "2026-03-30T00:00:00Z", equity: 1500 },
  ];

  it("returns the input untouched for all", () => {
    expect(equityPointsInRange(points, "all")).toBe(points);
  });

  it("keeps only points within the trailing window of the newest point", () => {
    expect(equityPointsInRange(points, "1m").map((p) => p.equity)).toEqual([1500]);
    expect(equityPointsInRange(points, "3m").map((p) => p.equity)).toEqual([1200, 1500]);
  });
});
