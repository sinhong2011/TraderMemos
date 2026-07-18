import { describe, expect, it } from "vite-plus/test";
import type { Trade } from "./api/types";
import { metricEvolution, rollingWinRate } from "./reportsAnalytics";

function trade(over: Partial<Trade>): Trade {
  return {
    id: "t1",
    account_id: "a1",
    symbol: "NQ",
    instrument_type: "future",
    direction: "long",
    status: "closed",
    opened_at: "2026-07-01T10:00:00Z",
    closed_at: "2026-07-01T11:00:00Z",
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

describe("rollingWinRate", () => {
  it("returns no points when there are fewer trades than the window", () => {
    const trades = [trade({ id: "1", net_pnl: 10 }), trade({ id: "2", net_pnl: -5 })];
    expect(rollingWinRate(trades, 3)).toEqual([]);
  });

  it("computes a trailing win rate once the window fills, in chronological order", () => {
    const trades = [
      trade({ id: "1", closed_at: "2026-07-01T12:00:00Z", net_pnl: 10 }),
      trade({ id: "2", closed_at: "2026-07-02T12:00:00Z", net_pnl: 10 }),
      trade({ id: "3", closed_at: "2026-07-03T12:00:00Z", net_pnl: -5 }),
      trade({ id: "4", closed_at: "2026-07-04T12:00:00Z", net_pnl: 10 }),
    ];
    const points = rollingWinRate(trades, 3);
    expect(points).toEqual([
      { index: 3, rate: 2 / 3 },
      { index: 4, rate: 2 / 3 },
    ]);
  });
});

describe("metricEvolution", () => {
  it("returns cumulative-to-date stats per day bucket", () => {
    const trades = [
      trade({ id: "1", closed_at: "2026-07-01T12:00:00Z", net_pnl: 100 }),
      trade({ id: "2", closed_at: "2026-07-01T14:00:00Z", net_pnl: -40 }),
      trade({ id: "3", closed_at: "2026-07-02T12:00:00Z", net_pnl: 20 }),
    ];
    const points = metricEvolution(trades, "day");
    expect(points).toHaveLength(2);
    expect(points[0].bucket).toBe("2026-07-01");
    expect(points[0].winRate).toBeCloseTo(0.5);
    expect(points[0].cumulativePnl).toBe(60);
    expect(points[1].bucket).toBe("2026-07-02");
    expect(points[1].winRate).toBeCloseTo(2 / 3);
    expect(points[1].cumulativePnl).toBe(80);
  });

  it("computes profitFactor, expectancy, and avgPnlPerTrade per bucket", () => {
    const trades = [
      trade({ id: "1", closed_at: "2026-07-01T12:00:00Z", net_pnl: 100 }),
      trade({ id: "2", closed_at: "2026-07-01T14:00:00Z", net_pnl: -40 }),
      trade({ id: "3", closed_at: "2026-07-02T12:00:00Z", net_pnl: 20 }),
    ];
    const points = metricEvolution(trades, "day");
    expect(points[0].profitFactor).toBeCloseTo(2.5);
    expect(points[0].expectancy).toBeCloseTo(30);
    expect(points[0].avgPnlPerTrade).toBeCloseTo(30);
    expect(points[1].profitFactor).toBeCloseTo(3);
    expect(points[1].expectancy).toBeCloseTo(26.67);
    expect(points[1].avgPnlPerTrade).toBeCloseTo(26.67);
  });

  it("returns an empty array with no closed trades", () => {
    expect(metricEvolution([trade({ status: "open", net_pnl: null })], "day")).toEqual([]);
  });
});

describe("metricEvolution week/month bucketing", () => {
  it("aligns week buckets to Monday", () => {
    const trades = [
      trade({ id: "1", closed_at: "2026-07-01T12:00:00Z", net_pnl: 10 }),
      trade({ id: "2", closed_at: "2026-07-08T12:00:00Z", net_pnl: 10 }),
    ];
    const points = metricEvolution(trades, "week");
    expect(points).toHaveLength(2);
    for (const p of points) {
      expect(new Date(p.bucket).getUTCDay()).toBe(1); // Monday
    }
    expect(points[0].bucket).not.toBe(points[1].bucket);
  });

  it("groups trades within the same calendar month into one bucket", () => {
    const trades = [
      trade({ id: "1", closed_at: "2026-07-01T12:00:00Z", net_pnl: 10 }),
      trade({ id: "2", closed_at: "2026-07-28T12:00:00Z", net_pnl: 10 }),
      trade({ id: "3", closed_at: "2026-08-01T12:00:00Z", net_pnl: 10 }),
    ];
    const points = metricEvolution(trades, "month");
    expect(points).toHaveLength(2);
    expect(points[0].bucket).toBe("2026-07-01");
    expect(points[1].bucket).toBe("2026-08-01");
    expect(points[0].cumulativePnl).toBe(20);
  });
});
