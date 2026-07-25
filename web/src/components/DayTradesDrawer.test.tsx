import { describe, expect, it } from "vite-plus/test";
import type { Trade } from "@/lib/api/types";
import { summarizeDayTrades } from "./DayTradesDrawer";

function trade(partial: Partial<Trade> & Pick<Trade, "id" | "net_pnl">): Trade {
  return {
    account_id: "a1",
    symbol: "AAPL",
    instrument_type: "stock",
    direction: "long",
    status: "closed",
    opened_at: "2026-07-01T10:00:00Z",
    closed_at: "2026-07-01T11:00:00Z",
    qty_opened: 1,
    qty_remaining: 0,
    avg_entry_price: 100,
    avg_exit_price: 101,
    gross_pnl: partial.net_pnl,
    fees_total: 0,
    pnl_currency: "USD",
    return_pct: null,
    time_in_trade_secs: 3600,
    notes: "",
    tags: [],
    ...partial,
  };
}

describe("summarizeDayTrades", () => {
  it("aggregates pnl, wins, losses, and win rate", () => {
    expect(
      summarizeDayTrades([
        trade({ id: "1", net_pnl: 100 }),
        trade({ id: "2", net_pnl: -40 }),
        trade({ id: "3", net_pnl: 25 }),
        trade({ id: "4", net_pnl: 0 }),
      ]),
    ).toEqual({
      pnl: 85,
      trades: 4,
      wins: 2,
      losses: 1,
      winRate: 2 / 3,
    });
  });
});
