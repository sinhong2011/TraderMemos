import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import type { BreakGroup, Summary } from "@/lib/api/types";
import { ReportsDisplayProvider } from "./ReportsDisplayContext";
import { ReportsSessionTable, SessionPnlCell } from "./ReportsSessionTable";

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

// DataTable is mocked above (its virtualizer needs a sized container in
// jsdom), which bypasses the real net_pnl cell renderer — so SessionPnlCell
// is tested directly instead.
describe("SessionPnlCell", () => {
  function summary(over: Partial<Summary>): Summary {
    return {
      total_trades: 1,
      wins: 1,
      losses: 0,
      breakeven: 0,
      win_rate: 1,
      net_pnl: 0,
      gross_profit: 0,
      gross_loss: 0,
      profit_factor: 1,
      expectancy: 0,
      avg_win: 0,
      avg_loss: 0,
      avg_trade: 0,
      largest_win: 0,
      largest_loss: 0,
      total_fees: 0,
      ...over,
    };
  }

  it("shows the gross P&L when pnlMode is gross", () => {
    // net_pnl (100) differs from before-fees gross_pnl (200).
    const s = summary({ net_pnl: 100, gross_pnl: 200 });
    render(
      <ReportsDisplayProvider
        value={{ pnlMode: "gross", unitMode: "abs", denominator: 0, currency: "USD", fxRate: 1 }}
      >
        <SessionPnlCell summary={s} />
      </ReportsDisplayProvider>,
    );
    expect(screen.getByText("+$200.00")).toBeInTheDocument();
  });

  it("shows a percentage of the denominator when unitMode is pct", () => {
    const s = summary({ net_pnl: 250 });
    render(
      <ReportsDisplayProvider
        value={{ pnlMode: "net", unitMode: "pct", denominator: 1000, currency: "USD", fxRate: 1 }}
      >
        <SessionPnlCell summary={s} />
      </ReportsDisplayProvider>,
    );
    expect(screen.getByText("25%")).toBeInTheDocument();
  });
});
