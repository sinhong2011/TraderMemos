import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import type { RSummary } from "../lib/api/types";
import { ReportsRMultiplePerformance } from "./ReportsRMultiplePerformance";

function rSummary(over: Partial<RSummary>): RSummary {
  return {
    total_trades: 18,
    wins: 9,
    losses: 6,
    breakeven: 0,
    win_rate: 0.5,
    net_pnl: 98.78,
    gross_profit: 200,
    gross_loss: 101,
    profit_factor: 1.34,
    expectancy: 5.49,
    avg_win: 42.88,
    avg_loss: 31.9,
    avg_trade: 5.49,
    largest_win: 123.69,
    largest_loss: 111.24,
    total_fees: 0,
    excluded: 9,
    avg_r: 1.05,
    avg_win_r: 2.14,
    avg_loss_r: -1.13,
    best_r: 7.12,
    worst_r: -1.91,
    distribution: [],
    ...over,
  };
}

describe("ReportsRMultiplePerformance", () => {
  it("renders the R-multiple stat tiles", () => {
    render(<ReportsRMultiplePerformance rSummary={rSummary({})} loading={false} error={false} />);
    expect(screen.getByText("+1.05R")).toBeInTheDocument();
    expect(screen.getByText("+2.14R")).toBeInTheDocument();
    expect(screen.getByText("-1.13R")).toBeInTheDocument();
  });

  it("shows an empty state with no R-eligible trades", () => {
    render(
      <ReportsRMultiplePerformance
        rSummary={rSummary({ total_trades: 5, excluded: 5 })}
        loading={false}
        error={false}
      />,
    );
    expect(screen.getByText("No R data")).toBeInTheDocument();
  });
});
