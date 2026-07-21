import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import type { BreakGroup } from "../lib/api/types";
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
    render(<ReportsHourlyList breakdown={[]} loading={false} error={false} currency="USD" />);
    expect(screen.getByText("Hourly")).toBeInTheDocument();
    expect(screen.getByText("No data")).toBeInTheDocument();
  });

  it("lists hours sorted by absolute P&L", () => {
    render(
      <ReportsHourlyList
        breakdown={[grp("09:00", 50), grp("14:00", -120), grp("11:00", 30)]}
        loading={false}
        error={false}
        currency="USD"
      />,
    );
    const hours = screen.getAllByText(/^\d{2}:\d{2}$/);
    expect(hours.map((el) => el.textContent)).toEqual(["14:00", "09:00", "11:00"]);
  });
});
