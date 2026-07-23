import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import type { Trade } from "../lib/api/types";
import { CalendarDayHoverDetails } from "./CalendarDayHoverDetails";

function trade(over: Partial<Trade>): Trade {
  return {
    id: "t1",
    account_id: "a1",
    symbol: "AAPL",
    instrument_type: "stock",
    direction: "long",
    status: "closed",
    opened_at: "2026-07-10T14:00:00Z",
    closed_at: "2026-07-10T15:30:00Z",
    qty_opened: 10,
    qty_remaining: 0,
    avg_entry_price: 100,
    avg_exit_price: 101,
    gross_pnl: 10,
    fees_total: 1,
    net_pnl: 9,
    pnl_currency: "USD",
    return_pct: 1,
    time_in_trade_secs: 5400,
    notes: "",
    tags: [],
    ...over,
  } as Trade;
}

describe("CalendarDayHoverDetails", () => {
  it("renders day trade rows in the hover card", () => {
    render(
      <CalendarDayHoverDetails
        date="2026-07-10"
        pnl={16.18}
        record={{ wins: 2, losses: 3 }}
        currency="USD"
        trades={[
          trade({ id: "a", symbol: "AAPL", net_pnl: 12 }),
          trade({
            id: "b",
            symbol: "MSFT",
            direction: "short",
            net_pnl: -4,
            closed_at: "2026-07-10T16:00:00Z",
          }),
        ]}
      />,
    );

    expect(screen.getByLabelText("Trades on 2026-07-10")).toBeInTheDocument();
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByText("MSFT")).toBeInTheDocument();
    expect(screen.getByText("long")).toBeInTheDocument();
    expect(screen.getByText("short")).toBeInTheDocument();
  });
});
