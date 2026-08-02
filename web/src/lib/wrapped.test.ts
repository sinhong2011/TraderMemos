import { describe, expect, it } from "vite-plus/test";
import type { Trade } from "./api/types";
import { computeYearWrapped } from "./wrapped";

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

describe("computeYearWrapped", () => {
  it("aggregates totals, months, symbols, and extremes", () => {
    const trades = [
      trade({ id: "1", closed_at: "2026-01-05T12:00:00Z", net_pnl: 100, fees_total: 2 }),
      trade({ id: "2", closed_at: "2026-01-06T12:00:00Z", net_pnl: -40, fees_total: 2 }),
      trade({
        id: "3",
        closed_at: "2026-03-10T12:00:00Z",
        net_pnl: 250,
        fees_total: 3,
        symbol: "ES",
      }),
      trade({ id: "4", closed_at: "2026-03-10T15:00:00Z", net_pnl: -10, fees_total: 1 }),
      trade({ id: "5", closed_at: "2026-03-11T12:00:00Z", net_pnl: 0, fees_total: 1 }),
    ];
    const w = computeYearWrapped(trades, 2026);

    expect(w.totalTrades).toBe(5);
    expect(w.wins).toBe(2);
    expect(w.losses).toBe(2);
    expect(w.breakeven).toBe(1);
    expect(w.netPnl).toBe(300);
    expect(w.grossProfit).toBe(350);
    expect(w.grossLoss).toBe(50);
    expect(w.profitFactor).toBe(7);
    expect(w.totalFees).toBe(9);

    expect(w.biggestWin).toEqual({ symbol: "ES", pnl: 250, date: "2026-03-10" });
    expect(w.biggestLoss).toEqual({ symbol: "NQ", pnl: -40, date: "2026-01-06" });

    expect(w.months[0].trades).toBe(2); // Jan
    expect(w.months[2].trades).toBe(3); // Mar
    expect(w.busiestMonth?.label).toBe("Mar");

    // NQ traded 4×, ES once.
    expect(w.topSymbols[0]).toMatchObject({ symbol: "NQ", trades: 4 });
    expect(w.topSymbols[1]).toMatchObject({ symbol: "ES", trades: 1 });

    // Days: 01-05 (+100), 01-06 (-40), 03-10 (+240), 03-11 (0) → 4 days, 2 green, 1 red.
    expect(w.tradingDays).toBe(4);
    expect(w.greenDays).toBe(2);
    expect(w.redDays).toBe(1);

    expect(w.totalHoldSecs).toBe(5 * 3600);
    expect(w.avgHoldSecs).toBe(3600);
  });

  it("ignores open trades and trades outside the year", () => {
    const trades = [
      trade({ id: "1", closed_at: "2026-02-01T12:00:00Z", net_pnl: 50 }),
      trade({ id: "2", closed_at: "2025-12-31T12:00:00Z", net_pnl: 999 }),
      trade({ id: "3", status: "open", closed_at: null, net_pnl: null }),
    ];
    const w = computeYearWrapped(trades, 2026);
    expect(w.totalTrades).toBe(1);
    expect(w.netPnl).toBe(50);
  });

  it("returns an empty recap for no trades", () => {
    const w = computeYearWrapped([], 2026);
    expect(w.totalTrades).toBe(0);
    expect(w.winRate).toBe(0);
    expect(w.biggestWin).toBeNull();
    expect(w.busiestMonth).toBeNull();
    expect(w.avgHoldSecs).toBeNull();
    expect(w.months).toHaveLength(12);
  });
});
