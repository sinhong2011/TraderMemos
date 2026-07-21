import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import type { Trade } from "../lib/api/types";
import { ReportsDisplayProvider } from "./ReportsDisplayContext";
import { buildReportsDayStrip, ReportsDayStrip } from "./ReportsDayStrip";

function trade(
  partial: Partial<Trade> & Pick<Trade, "id" | "net_pnl" | "closed_at" | "status">,
): Trade {
  return {
    account_id: "a1",
    symbol: "AAPL",
    instrument_type: "stock",
    direction: "long",
    opened_at: partial.closed_at ?? "2024-05-06T10:00:00Z",
    qty_opened: 1,
    qty_remaining: 0,
    avg_entry_price: 100,
    avg_exit_price: 101,
    gross_pnl: partial.gross_pnl ?? partial.net_pnl,
    fees_total: 0,
    pnl_currency: "USD",
    return_pct: null,
    time_in_trade_secs: 3600,
    notes: "",
    tags: [],
    ...partial,
  };
}

describe("buildReportsDayStrip", () => {
  it("aggregates closed trades by day and sorts ascending", () => {
    const days = buildReportsDayStrip([
      trade({ id: "1", net_pnl: 100, closed_at: "2024-05-07T15:00:00Z", status: "closed" }),
      trade({ id: "2", net_pnl: -40, closed_at: "2024-05-06T15:00:00Z", status: "closed" }),
      trade({ id: "3", net_pnl: 25, closed_at: "2024-05-07T16:00:00Z", status: "closed" }),
      trade({
        id: "4",
        net_pnl: 10,
        closed_at: "2024-05-06T10:00:00Z",
        status: "open",
      }),
    ]);
    expect(days).toEqual([
      { date: "2024-05-06", pnl: -40, trades: 1 },
      { date: "2024-05-07", pnl: 125, trades: 2 },
    ]);
  });
});

describe("ReportsDayStrip", () => {
  it("renders nothing when there are no closed trading days", () => {
    const { container } = render(<ReportsDayStrip trades={[]} loading={false} currency="USD" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders day cards with P&L", () => {
    render(
      <ReportsDayStrip
        trades={[
          trade({
            id: "1",
            net_pnl: 214.9,
            closed_at: "2024-05-06T15:00:00Z",
            status: "closed",
          }),
        ]}
        currency="USD"
      />,
    );
    expect(screen.getByText("Trading days")).toBeInTheDocument();
    expect(screen.getByText(/\+\$214\.90/)).toBeInTheDocument();
    expect(screen.getByText("1 trade")).toBeInTheDocument();
  });

  it("shows gross daily P&L when pnlMode is gross", () => {
    render(
      <ReportsDisplayProvider
        value={{ pnlMode: "gross", unitMode: "abs", denominator: 0, currency: "USD", fxRate: 1 }}
      >
        <ReportsDayStrip
          trades={[
            trade({
              id: "1",
              net_pnl: 100,
              gross_pnl: 200,
              closed_at: "2024-05-06T15:00:00Z",
              status: "closed",
            }),
          ]}
        />
      </ReportsDisplayProvider>,
    );
    expect(screen.getByText("+$200.00")).toBeInTheDocument();
    expect(screen.queryByText("+$100.00")).not.toBeInTheDocument();
  });

  it("shows a percentage when unitMode is pct", () => {
    render(
      <ReportsDisplayProvider
        value={{ pnlMode: "net", unitMode: "pct", denominator: 1000, currency: "USD", fxRate: 1 }}
      >
        <ReportsDayStrip
          trades={[
            trade({
              id: "1",
              net_pnl: 250,
              closed_at: "2024-05-06T15:00:00Z",
              status: "closed",
            }),
          ]}
        />
      </ReportsDisplayProvider>,
    );
    expect(screen.getByText("25%")).toBeInTheDocument();
  });
});
