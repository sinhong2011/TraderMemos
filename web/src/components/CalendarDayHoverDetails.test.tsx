import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import type { Trade } from "@/lib/api/types";
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
          trade({
            id: "c",
            symbol: "SPY 260117C500",
            instrument_type: "option",
            net_pnl: 30,
            closed_at: "2026-07-10T17:00:00Z",
          }),
        ]}
      />,
    );

    expect(screen.getByLabelText("Trades on 2026-07-10")).toBeInTheDocument();
    // Market type leads each row.
    expect(screen.getAllByText("STK")).toHaveLength(2);
    expect(screen.getByText("OPT")).toBeInTheDocument();
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByText("MSFT")).toBeInTheDocument();
    // Direction and call/put read as one label.
    expect(screen.getByText("Long")).toBeInTheDocument();
    expect(screen.getByText("Short")).toBeInTheDocument();
    expect(screen.getByText("Long Call")).toBeInTheDocument();
  });

  it("renders the at-a-glance stats and day review link when detail is given", async () => {
    const userEvent = (await import("@testing-library/user-event")).default.setup();
    let opened: string | null = null;
    render(
      <CalendarDayHoverDetails
        date="2026-07-10"
        pnl={150}
        record={{ wins: 1, losses: 1 }}
        currency="USD"
        detail={{
          pnl: 150,
          pct: 0.015,
          startBalance: 10000,
          endBalance: 10150,
          deposits: 0,
          fees: 5,
          trades: 2,
          winRate: 0.5,
          profitFactor: 4,
          expectancy: 75,
        }}
        onOpenDayReview={(day) => {
          opened = day;
        }}
      />,
    );

    expect(screen.getByText("+1.5%")).toBeInTheDocument();
    expect(screen.getByText("Balance")).toBeInTheDocument();
    expect(screen.getByText("$10,000.00 → $10,150.00")).toBeInTheDocument();
    // Zero deposits render as a formatted zero, never a dash.
    expect(screen.getByText("Deposits")).toBeInTheDocument();
    expect(screen.getByText("$0.00")).toBeInTheDocument();
    expect(screen.getByText("Comm & fees")).toBeInTheDocument();
    expect(screen.getByText("$5.00")).toBeInTheDocument();
    expect(screen.getByText("Profit factor")).toBeInTheDocument();
    expect(screen.getByText("4.00")).toBeInTheDocument();
    expect(screen.getByText("Expectancy")).toBeInTheDocument();
    expect(screen.getByText("+$75.00")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /view day review/i }));
    expect(opened).toBe("2026-07-10");
  });
});
