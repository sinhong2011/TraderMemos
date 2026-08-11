import { describe, expect, it } from "vite-plus/test";
import type { EquityPoint, Trade } from "./api/types";
import {
  avgRiskPerTrade,
  currentDrawdownPct,
  drawdownSeries,
  durationScatter,
  maxDrawdownPct,
  medianDurationSecs,
  metricEvolution,
  periodReturns,
  rollingWinRate,
} from "./reportsAnalytics";

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

  it("honors a custom tradePnl accessor (gross)", () => {
    const trades = [
      trade({ id: "1", closed_at: "2026-07-01T12:00:00Z", net_pnl: 100, gross_pnl: 200 }),
    ];
    const points = metricEvolution(trades, "day", (t) => t.gross_pnl ?? t.net_pnl ?? 0);
    expect(points[0].cumulativePnl).toBe(200);
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

describe("drawdownSeries", () => {
  it("tracks running peak-to-trough drawdown as a fraction", () => {
    const points: EquityPoint[] = [
      { at: "2026-07-01T00:00:00Z", equity: 1000 },
      { at: "2026-07-02T00:00:00Z", equity: 1200 },
      { at: "2026-07-03T00:00:00Z", equity: 900 },
      { at: "2026-07-04T00:00:00Z", equity: 1100 },
    ];
    const series = drawdownSeries(points);
    expect(series[0].drawdownPct).toBe(0);
    expect(series[1].drawdownPct).toBe(0);
    expect(series[2].drawdownPct).toBeCloseTo((900 - 1200) / 1200);
    expect(series[3].drawdownPct).toBeCloseTo((1100 - 1200) / 1200);
  });

  it("reports current and max drawdown from the same series", () => {
    const points: EquityPoint[] = [
      { at: "2026-07-01T00:00:00Z", equity: 1000 },
      { at: "2026-07-02T00:00:00Z", equity: 1200 },
      { at: "2026-07-03T00:00:00Z", equity: 900 },
    ];
    expect(maxDrawdownPct(points)).toBeCloseTo((900 - 1200) / 1200);
    expect(currentDrawdownPct(points)).toBeCloseTo((900 - 1200) / 1200);
  });

  it("returns 0 for an empty series", () => {
    expect(currentDrawdownPct([])).toBe(0);
    expect(maxDrawdownPct([])).toBe(0);
  });
});

describe("avgRiskPerTrade", () => {
  it("averages only trades with a positive initial_risk", () => {
    const trades = [
      trade({ id: "1", initial_risk: 100 }),
      trade({ id: "2", initial_risk: 200 }),
      trade({ id: "3", initial_risk: null }),
    ];
    const result = avgRiskPerTrade(trades);
    expect(result.avg).toBe(150);
    expect(result.included).toBe(2);
    expect(result.excluded).toBe(1);
  });

  it("returns null avg when no trades have risk set", () => {
    const result = avgRiskPerTrade([trade({ id: "1", initial_risk: null })]);
    expect(result.avg).toBeNull();
    expect(result.included).toBe(0);
    expect(result.excluded).toBe(1);
  });
});

describe("durationScatter", () => {
  it("keeps only closed trades with a known hold time", () => {
    const trades = [
      trade({ id: "1", time_in_trade_secs: 600, net_pnl: 50 }),
      trade({ id: "2", time_in_trade_secs: null }),
      trade({ id: "3", time_in_trade_secs: 0 }),
      trade({ id: "4", status: "open", net_pnl: null, time_in_trade_secs: 100 }),
    ];
    const points = durationScatter(trades);
    expect(points).toEqual([{ id: "1", symbol: "NQ", secs: 600, pnl: 50 }]);
  });

  it("uses the provided pnl accessor", () => {
    const trades = [trade({ id: "1", gross_pnl: 20, net_pnl: 10 })];
    const points = durationScatter(trades, (t) => t.gross_pnl ?? 0);
    expect(points[0].pnl).toBe(20);
  });
});

describe("medianDurationSecs", () => {
  it("returns 0 for no points", () => {
    expect(medianDurationSecs([])).toBe(0);
  });

  it("takes the middle value for odd counts and the mean of the middle pair for even", () => {
    const p = (secs: number) => ({ id: String(secs), symbol: "NQ", secs, pnl: 0 });
    expect(medianDurationSecs([p(10), p(1000), p(100)])).toBe(100);
    expect(medianDurationSecs([p(10), p(20), p(100), p(1000)])).toBe(60);
  });
});

describe("periodReturns", () => {
  it("returns null with no closed trades", () => {
    expect(periodReturns([])).toBeNull();
    expect(periodReturns([trade({ status: "open", net_pnl: null })])).toBeNull();
  });

  it("averages per traded day, week and month", () => {
    // Two days in one ISO week, one day in another month.
    const trades = [
      trade({ id: "1", closed_at: "2026-07-06T15:00:00Z", net_pnl: 100 }),
      trade({ id: "2", closed_at: "2026-07-06T18:00:00Z", net_pnl: 50 }),
      trade({ id: "3", closed_at: "2026-07-07T15:00:00Z", net_pnl: -30 }),
      trade({ id: "4", closed_at: "2026-08-03T15:00:00Z", net_pnl: 60 }),
    ];
    const r = periodReturns(trades);
    expect(r).not.toBeNull();
    if (!r) return;
    expect(r.tradingDays).toBe(3);
    expect(r.daily).toBeCloseTo(180 / 3);
    expect(r.weekly).toBeCloseTo(180 / 2); // Jul 6–7 share a Monday week
    expect(r.monthly).toBeCloseTo(180 / 2);
    // Span Jul 6 → Aug 3 inclusive = 29 days.
    expect(r.annualized).toBeCloseTo((180 * 365) / 29);
  });

  it("annualizes a single-day span against one day", () => {
    const r = periodReturns([trade({ id: "1", closed_at: "2026-07-06T15:00:00Z", net_pnl: 10 })]);
    expect(r?.annualized).toBeCloseTo(10 * 365);
  });

  it("buckets days through the provided day key", () => {
    // Shift both trades onto the same custom day.
    const trades = [
      trade({ id: "1", closed_at: "2026-07-06T23:30:00Z", net_pnl: 10 }),
      trade({ id: "2", closed_at: "2026-07-07T00:30:00Z", net_pnl: 20 }),
    ];
    const r = periodReturns(trades, undefined, () => "2026-07-06");
    expect(r?.tradingDays).toBe(1);
    expect(r?.daily).toBe(30);
  });
});
