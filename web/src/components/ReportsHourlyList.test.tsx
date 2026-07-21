import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import type { BreakGroup } from "../lib/api/types";
import { ReportsDisplayProvider } from "./ReportsDisplayContext";
import { ReportsHourlyList } from "./ReportsHourlyList";

function grp(key: string, net: number, winRate = 0.5): BreakGroup {
  return {
    key,
    summary: {
      total_trades: 4,
      wins: 2,
      losses: 2,
      breakeven: 0,
      win_rate: winRate,
      net_pnl: net,
      gross_profit: Math.max(net, 0),
      gross_loss: Math.max(-net, 0),
      profit_factor: 1,
      expectancy: net / 4,
      avg_win: 10,
      avg_loss: 8,
      avg_trade: net / 4,
      largest_win: 20,
      largest_loss: 15,
      total_fees: 0,
    },
  };
}

describe("ReportsHourlyList", () => {
  it("shows empty state with no hours", () => {
    render(<ReportsHourlyList breakdown={[]} loading={false} error={false} />);
    expect(screen.getByText("Hourly")).toBeInTheDocument();
    expect(screen.getByText("No data")).toBeInTheDocument();
  });

  it("lists hours sorted by absolute P&L", () => {
    render(
      <ReportsHourlyList
        breakdown={[grp("09:00", 50), grp("14:00", -120), grp("11:00", 30)]}
        loading={false}
        error={false}
      />,
    );
    const hours = screen.getAllByText(/^\d{2}:\d{2}$/);
    expect(hours.map((el) => el.textContent)).toEqual(["14:00", "09:00", "11:00"]);
  });

  it("shows the gross P&L when pnlMode is gross", () => {
    // net_pnl (100) differs from gross (gross_profit - gross_loss = 300 - 20 = 280).
    const g: BreakGroup = {
      key: "09:00",
      summary: {
        total_trades: 4,
        wins: 2,
        losses: 2,
        breakeven: 0,
        win_rate: 0.5,
        net_pnl: 100,
        gross_profit: 300,
        gross_loss: 20,
        profit_factor: 1,
        expectancy: 25,
        avg_win: 10,
        avg_loss: 8,
        avg_trade: 25,
        largest_win: 20,
        largest_loss: 15,
        total_fees: 0,
      },
    };
    render(
      <ReportsDisplayProvider
        value={{ pnlMode: "gross", unitMode: "abs", denominator: 0, currency: "USD", fxRate: 1 }}
      >
        <ReportsHourlyList breakdown={[g]} loading={false} error={false} />
      </ReportsDisplayProvider>,
    );
    expect(screen.getByText("+$280.00")).toBeInTheDocument();
    expect(screen.queryByText("+$100.00")).not.toBeInTheDocument();
  });

  it("shows a percentage of the denominator when unitMode is pct", () => {
    render(
      <ReportsDisplayProvider
        value={{
          pnlMode: "net",
          unitMode: "pct",
          denominator: 1000,
          currency: "USD",
          fxRate: 1,
        }}
      >
        <ReportsHourlyList breakdown={[grp("09:00", 250)]} loading={false} error={false} />
      </ReportsDisplayProvider>,
    );
    expect(screen.getByText("25%")).toBeInTheDocument();
  });
});
