import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import type { EquityPoint, Trade } from "../lib/api/types";
import { ReportsRiskDrawdown } from "./ReportsRiskDrawdown";

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

describe("ReportsRiskDrawdown", () => {
  it("shows an empty state with no equity points", () => {
    render(
      <ReportsRiskDrawdown
        trades={[]}
        equityPoints={[]}
        loading={false}
        error={false}
        currency="USD"
      />,
    );
    expect(screen.getByText("No data")).toBeInTheDocument();
  });

  it("renders drawdown and risk stat tiles", () => {
    const points: EquityPoint[] = [
      { at: "2026-07-01T00:00:00Z", equity: 1000 },
      { at: "2026-07-02T00:00:00Z", equity: 900 },
    ];
    render(
      <ReportsRiskDrawdown
        trades={[trade({ initial_risk: 100 }), trade({ id: "t2", initial_risk: 200 })]}
        equityPoints={points}
        loading={false}
        error={false}
        currency="USD"
      />,
    );
    expect(screen.getByText("Max Drawdown")).toBeInTheDocument();
    expect(screen.getByText("Current Drawdown")).toBeInTheDocument();
    expect(screen.getByText("Avg Risk/Trade")).toBeInTheDocument();
    expect(screen.queryByText("Longest Losing Streak")).not.toBeInTheDocument();
  });
});
