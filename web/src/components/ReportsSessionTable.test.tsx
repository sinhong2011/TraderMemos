import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import type { BreakGroup } from "../lib/api/types";
import { ReportsSessionTable } from "./ReportsSessionTable";

vi.mock("./DataTable", () => ({
  DataTable: ({ data }: { data: BreakGroup[] }) => (
    <div data-testid="table">
      {data.map((g) => (
        <div key={g.key}>
          {g.key} {g.summary.total_trades}
        </div>
      ))}
    </div>
  ),
}));

function grp(key: string): BreakGroup {
  return {
    key,
    summary: {
      total_trades: 18,
      wins: 9,
      losses: 9,
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
    },
  };
}

describe("ReportsSessionTable", () => {
  it("shows an empty state with no data", () => {
    render(<ReportsSessionTable breakdown={[]} loading={false} error={false} currency="USD" />);
    expect(screen.getByText("No data")).toBeInTheDocument();
  });

  it("renders session rows", () => {
    render(
      <ReportsSessionTable
        breakdown={[grp("Unsessioned")]}
        loading={false}
        error={false}
        currency="USD"
      />,
    );
    expect(screen.getByText(/Unsessioned/)).toBeInTheDocument();
  });
});
