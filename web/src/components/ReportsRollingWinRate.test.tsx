import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import type { Trade } from "@/lib/api/types";
import { ReportsRollingWinRate } from "./ReportsRollingWinRate";

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

describe("ReportsRollingWinRate", () => {
  it("shows an empty state without enough closed trades for the default window", () => {
    render(<ReportsRollingWinRate trades={[trade({})]} loading={false} error={false} />);
    expect(screen.getByText("Not enough trades")).toBeInTheDocument();
  });

  it("renders the latest rolling win rate once the window fills", () => {
    const trades = Array.from({ length: 10 }, (_, i) =>
      trade({
        id: String(i),
        closed_at: `2026-07-${String(i + 1).padStart(2, "0")}T12:00:00Z`,
        net_pnl: i < 5 ? 10 : -10,
      }),
    );
    render(<ReportsRollingWinRate trades={trades} loading={false} error={false} />);
    expect(screen.getByText("50%")).toBeInTheDocument();
  });
});
