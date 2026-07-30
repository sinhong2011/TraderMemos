import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import type { Trade } from "@/lib/api/types";
import { ReportsDisplayProvider } from "./ReportsDisplayContext";
import { ReportsMetricEvolution } from "./ReportsMetricEvolution";

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

describe("ReportsMetricEvolution", () => {
  it("shows an empty state with no closed trades", () => {
    render(<ReportsMetricEvolution trades={[]} loading={false} error={false} currency="USD" />);
    expect(screen.getByText("No data")).toBeInTheDocument();
  });

  it("renders the granularity and right-axis metric controls once there is data", () => {
    render(
      <ReportsMetricEvolution trades={[trade({})]} loading={false} error={false} currency="USD" />,
    );
    expect(screen.getByRole("group", { name: "Evolution granularity" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Right axis metric" })).toBeInTheDocument();
  });

  it("re-expresses cumulative P&L as a percentage under unitMode pct", () => {
    render(
      <ReportsDisplayProvider
        value={{ pnlMode: "net", unitMode: "pct", denominator: 1000, currency: "USD", fxRate: 1 }}
      >
        <ReportsMetricEvolution
          trades={[trade({ net_pnl: 250, gross_pnl: 250 })]}
          loading={false}
          error={false}
        />
      </ReportsDisplayProvider>,
    );
    // 250 / 1000 = 25%
    expect(screen.getByTestId("evolution-last-cum-pnl")).toHaveTextContent("25%");
  });

  it("uses gross trade P&L for cumulative when pnlMode is gross", () => {
    render(
      <ReportsDisplayProvider
        value={{ pnlMode: "gross", unitMode: "abs", denominator: 0, currency: "USD", fxRate: 1 }}
      >
        <ReportsMetricEvolution
          trades={[trade({ net_pnl: 100, gross_pnl: 200 })]}
          loading={false}
          error={false}
        />
      </ReportsDisplayProvider>,
    );
    expect(screen.getByTestId("evolution-last-cum-pnl")).toHaveTextContent("+$200");
  });
});
