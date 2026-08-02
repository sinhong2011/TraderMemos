import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import type { Summary } from "@/lib/api/types";
import { ReportsDisplayProvider } from "./ReportsDisplayContext";
import { ReportsSummaryBento } from "./ReportsSummaryBento";

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
  median_win: 90,
  median_loss: 80,
  median_trade: 10,
  kelly_pct: 25,
  sqn: 2.6,
};

describe("ReportsSummaryBento", () => {
  it("renders edge metrics and hero sections", () => {
    render(<ReportsSummaryBento summary={summary} trades={[]} currency="USD" />);
    expect(screen.getByText("Performance")).toBeInTheDocument();
    expect(screen.getByText("Edge metrics")).toBeInTheDocument();
    expect(screen.getByText("Profit factor")).toBeInTheDocument();
    expect(screen.getByText("Win rate")).toBeInTheDocument();
    expect(screen.getByText("Payoff ratio")).toBeInTheDocument();
    expect(screen.getByText("Session context")).toBeInTheDocument();
  });

  it("maps profit factor onto the gauge fill (pf/3, capped)", () => {
    render(<ReportsSummaryBento summary={summary} trades={[]} currency="USD" />);
    const fill = screen.getByTestId("gauge-fill");
    const offset = Number(fill.getAttribute("stroke-dashoffset"));
    expect(offset).toBeGreaterThan(42);
    expect(offset).toBeLessThan(44);
    expect(screen.getByText("1.71")).toBeInTheDocument();
  });

  it("draws a win/loss donut and shows the win rate in the hole", () => {
    render(<ReportsSummaryBento summary={summary} trades={[]} currency="USD" />);
    const segs = screen.getAllByTestId("donut-seg");
    expect(segs).toHaveLength(2);
    expect(segs[0].getAttribute("stroke-dasharray")).toBe("60 40");
    expect(screen.getByText("60%")).toBeInTheDocument();
  });

  it("renders avg win and avg loss in the split bar", () => {
    render(<ReportsSummaryBento summary={summary} trades={[]} currency="USD" />);
    expect(screen.getByText("+$100.00")).toBeInTheDocument();
    expect(screen.getByText("+$87.50")).toBeInTheDocument();
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
    render(<ReportsSummaryBento summary={empty} trades={[]} currency="USD" />);
    expect(screen.getByTestId("gauge-fill").getAttribute("stroke-dashoffset")).toBe("100");
    expect(screen.queryAllByTestId("donut-seg")).toHaveLength(0);
    expect(screen.getByText("Payoff ratio")).toBeInTheDocument();
  });

  it("shows an infinite payoff and an all-green split bar when avg loss is zero", () => {
    const noLoss: Summary = { ...summary, avg_win: 100, avg_loss: 0 };
    render(<ReportsSummaryBento summary={noLoss} trades={[]} currency="USD" />);
    expect(screen.getByText("∞")).toBeInTheDocument();
    const winSegment = document.querySelector<HTMLElement>(".bg-profit[style*='width: 100%']");
    expect(winSegment).not.toBeNull();
  });

  it("shows the gross P&L in the hero when pnlMode is gross", () => {
    // net_pnl 500; gross = gross_profit - gross_loss = 1200 - 700 = 500… use distinct values.
    const s: Summary = {
      ...summary,
      net_pnl: 100,
      gross_profit: 260,
      gross_loss: 60, // gross P&L = 200
    };
    render(
      <ReportsDisplayProvider
        value={{ pnlMode: "gross", unitMode: "abs", denominator: 0, currency: "USD", fxRate: 1 }}
      >
        <ReportsSummaryBento summary={s} trades={[]} />
      </ReportsDisplayProvider>,
    );
    const performance = screen.getByText("Performance").closest("section");
    expect(performance).not.toBeNull();
    expect(within(performance as HTMLElement).getByText("+$200.00")).toBeInTheDocument();
    expect(within(performance as HTMLElement).queryByText("+$100.00")).not.toBeInTheDocument();
    // Ratios stay unchanged.
    expect(screen.getByText("1.71")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
  });

  it("renders Kelly % and SQN tiles from the summary", () => {
    render(<ReportsSummaryBento summary={summary} trades={[]} currency="USD" />);
    expect(screen.getByText("Kelly %")).toBeInTheDocument();
    expect(screen.getByText("25.0%")).toBeInTheDocument();
    expect(screen.getByText("SQN")).toBeInTheDocument();
    expect(screen.getByText("2.60")).toBeInTheDocument();
    expect(screen.getByText("system quality: good")).toBeInTheDocument();
  });

  it("falls back to placeholders when kelly/sqn are unavailable", () => {
    const legacy: Summary = {
      ...summary,
      median_win: undefined,
      median_loss: undefined,
      median_trade: undefined,
      kelly_pct: undefined,
      sqn: undefined,
    };
    render(<ReportsSummaryBento summary={legacy} trades={[]} currency="USD" />);
    expect(screen.getByText("needs a win and a loss")).toBeInTheDocument();
    expect(screen.getByText("needs 2+ varied trades")).toBeInTheDocument();
  });

  it("swaps avg stats for medians when avgMode is median", () => {
    render(
      <ReportsDisplayProvider
        value={{
          pnlMode: "net",
          unitMode: "abs",
          avgMode: "median",
          denominator: 0,
          currency: "USD",
          fxRate: 1,
        }}
      >
        <ReportsSummaryBento summary={summary} trades={[]} />
      </ReportsDisplayProvider>,
    );
    expect(screen.getByText("Median win")).toBeInTheDocument();
    expect(screen.getByText("Median loss")).toBeInTheDocument();
    expect(screen.getByText("Median trade")).toBeInTheDocument();
    expect(screen.getByText("+$90.00")).toBeInTheDocument();
    expect(screen.getByText("+$80.00")).toBeInTheDocument();
    expect(screen.getByText("median win ÷ median loss")).toBeInTheDocument();
    // Payoff recomputes from medians: 90/80 = 1.13×
    expect(screen.getByText("1.13×")).toBeInTheDocument();
  });

  it("shows a percentage of the denominator when unitMode is pct", () => {
    render(
      <ReportsDisplayProvider
        value={{ pnlMode: "net", unitMode: "pct", denominator: 1000, currency: "USD", fxRate: 1 }}
      >
        <ReportsSummaryBento summary={summary} trades={[]} />
      </ReportsDisplayProvider>,
    );
    const performance = screen.getByText("Performance").closest("section");
    expect(performance).not.toBeNull();
    // net_pnl 500 / 1000 = 50%
    expect(within(performance as HTMLElement).getByText("50%")).toBeInTheDocument();
    // Win rate stays a ratio (not the unit toggle).
    expect(screen.getByText("60%")).toBeInTheDocument();
  });
});
