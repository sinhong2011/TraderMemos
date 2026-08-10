import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { CalendarWeekHoverDetails } from "./CalendarWeekHoverDetails";

describe("CalendarWeekHoverDetails", () => {
  it("renders the at-a-glance stats and week review link when detail is given", async () => {
    const userEvent = (await import("@testing-library/user-event")).default.setup();
    let opened = false;
    render(
      <CalendarWeekHoverDetails
        firstDate="2026-07-01"
        lastDate="2026-07-05"
        weekNumber={1}
        pnl={150}
        hasData
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
          tradingDays: 2,
          bestDay: { date: "2026-07-02", pnl: 200 },
          worstDay: { date: "2026-07-01", pnl: -50 },
        }}
        onOpenWeekReview={() => {
          opened = true;
        }}
      />,
    );

    expect(screen.getByText(/Week 1/)).toBeInTheDocument();
    expect(screen.getByText("+1.5%")).toBeInTheDocument();
    expect(screen.getByText("Balance")).toBeInTheDocument();
    expect(screen.getByText("$10,000.00 → $10,150.00")).toBeInTheDocument();
    expect(screen.getByText("Deposits")).toBeInTheDocument();
    expect(screen.getByText("$0.00")).toBeInTheDocument();
    expect(screen.getByText("Comm & fees")).toBeInTheDocument();
    expect(screen.getByText("$5.00")).toBeInTheDocument();
    expect(screen.getByText("Profit factor")).toBeInTheDocument();
    expect(screen.getByText("4.00")).toBeInTheDocument();
    expect(screen.getByText("Expectancy")).toBeInTheDocument();
    expect(screen.getByText("+$75.00")).toBeInTheDocument();
    expect(screen.getByText("Best")).toBeInTheDocument();
    expect(screen.getByText("Worst")).toBeInTheDocument();
    expect(screen.getByText("2 trading days · 2 trades")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /view week review/i }));
    expect(opened).toBe(true);
  });

  it("renders formatted zeros for deposits without dashes", () => {
    render(
      <CalendarWeekHoverDetails
        firstDate="2026-07-01"
        lastDate="2026-07-05"
        weekNumber={1}
        pnl={0}
        hasData
        currency="USD"
        detail={{
          pnl: 0,
          pct: 0,
          startBalance: 10000,
          endBalance: 10000,
          deposits: 0,
          fees: 0,
          trades: 0,
          winRate: null,
          profitFactor: null,
          expectancy: null,
          tradingDays: 0,
          bestDay: null,
          worstDay: null,
        }}
      />,
    );

    expect(screen.getAllByText("$0.00").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });

  it("renders No trades for an empty week without dashes", () => {
    render(
      <CalendarWeekHoverDetails
        firstDate="2026-07-06"
        lastDate="2026-07-12"
        weekNumber={2}
        pnl={0}
        hasData={false}
        currency="USD"
      />,
    );

    expect(screen.getByText("No trades")).toBeInTheDocument();
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });
});
