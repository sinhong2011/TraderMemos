import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import type { Summary } from "../lib/api/types";
import { ReportsInsightWidgets } from "./ReportsInsightWidgets";

const summary: Summary = {
  total_trades: 20,
  wins: 12,
  losses: 8,
  breakeven: 0,
  win_rate: 0.6,
  net_pnl: 500,
  gross_profit: 1200,
  gross_loss: 700,
  profit_factor: 1.71,
  expectancy: 25,
  avg_win: 100,
  avg_loss: 87.5,
  avg_trade: 25,
  largest_win: 200,
  largest_loss: 150,
  total_fees: 20,
};

describe("ReportsInsightWidgets", () => {
  it("renders all four widget titles", () => {
    render(<ReportsInsightWidgets summary={summary} currency="USD" />);
    expect(screen.getByText("Profit factor")).toBeInTheDocument();
    expect(screen.getByText("Winning vs losing")).toBeInTheDocument();
    expect(screen.getByText("Avg win vs avg loss")).toBeInTheDocument();
    expect(screen.getByText("Payoff ratio")).toBeInTheDocument();
  });

  it("maps profit factor onto the gauge fill (pf/3, capped)", () => {
    render(<ReportsInsightWidgets summary={summary} currency="USD" />);
    // pf 1.71 -> fraction 0.57 -> dashoffset 100*(1-0.57)=43 (rounded)
    const fill = screen.getByTestId("gauge-fill");
    const offset = Number(fill.getAttribute("stroke-dashoffset"));
    expect(offset).toBeGreaterThan(42);
    expect(offset).toBeLessThan(44);
    expect(screen.getByText("1.71")).toBeInTheDocument();
  });

  it("draws a win/loss donut and shows the win rate in the hole", () => {
    render(<ReportsInsightWidgets summary={summary} currency="USD" />);
    const segs = screen.getAllByTestId("donut-seg");
    expect(segs).toHaveLength(2); // wins + losses, breakeven 0 skipped
    expect(segs[0].getAttribute("stroke-dasharray")).toBe("60 40");
    expect(screen.getByText("60%")).toBeInTheDocument();
  });

  it("renders both dollar values in the avg-win-vs-loss split bar", () => {
    render(<ReportsInsightWidgets summary={summary} currency="USD" />);
    expect(screen.getByText("$100.00")).toBeInTheDocument();
    expect(screen.getByText("$87.50")).toBeInTheDocument();
  });

  it("handles a zero-trade summary without crashing", () => {
    const empty: Summary = {
      ...summary,
      total_trades: 0,
      wins: 0,
      losses: 0,
      win_rate: 0,
      profit_factor: 0,
      avg_win: 0,
      avg_loss: 0,
    };
    render(<ReportsInsightWidgets summary={empty} currency="USD" />);
    expect(screen.getByTestId("gauge-fill").getAttribute("stroke-dashoffset")).toBe("100");
    expect(screen.queryAllByTestId("donut-seg")).toHaveLength(0);
    expect(screen.getByText("Payoff ratio")).toBeInTheDocument();
  });

  it("shows an infinite payoff and an all-green split bar when avg loss is zero", () => {
    const noLoss: Summary = { ...summary, avg_win: 100, avg_loss: 0 };
    render(<ReportsInsightWidgets summary={noLoss} currency="USD" />);
    expect(screen.getByText("∞")).toBeInTheDocument();
    // winLossTotal > 0 with avgLoss 0 → win segment takes the full bar width.
    const winSegment = document.querySelector<HTMLElement>(".bg-profit[style*='width: 100%']");
    expect(winSegment).not.toBeNull();
  });
});
