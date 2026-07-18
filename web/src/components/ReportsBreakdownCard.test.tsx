import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ColumnDef } from "@tanstack/react-table";
import { describe, expect, it, vi } from "vite-plus/test";
import type { BreakGroup } from "../lib/api/types";
import { ReportsBreakdownCard } from "./ReportsBreakdownCard";

// Mock DataTable (virtualizer needs a sized container in jsdom) — same pattern as ReportsView.test.tsx.
vi.mock("./DataTable", () => ({
  DataTable: ({ data }: { data: BreakGroup[] }) => (
    <div data-testid="table">
      {data.map((g) => (
        <div key={g.key}>{g.key}</div>
      ))}
    </div>
  ),
}));

function grp(key: string, net: number): BreakGroup {
  return {
    key,
    summary: {
      total_trades: 1,
      wins: net >= 0 ? 1 : 0,
      losses: net < 0 ? 1 : 0,
      breakeven: 0,
      win_rate: net >= 0 ? 1 : 0,
      net_pnl: net,
      gross_profit: net > 0 ? net : 0,
      gross_loss: net < 0 ? -net : 0,
      profit_factor: 0,
      expectancy: net,
      avg_win: 0,
      avg_loss: 0,
      avg_trade: net,
      largest_win: 0,
      largest_loss: 0,
      total_fees: 0,
    },
  };
}

describe("ReportsBreakdownCard", () => {
  it("shows an empty state with no data", () => {
    render(
      <ReportsBreakdownCard
        title="Day of Week"
        breakdown={[]}
        loading={false}
        error={false}
        currency="USD"
      />,
    );
    expect(screen.getByText("No data")).toBeInTheDocument();
  });

  it("renders the card title", () => {
    render(
      <ReportsBreakdownCard
        title="Day of Week"
        breakdown={[grp("Monday", 200), grp("Tuesday", -50)]}
        loading={false}
        error={false}
        currency="USD"
      />,
    );
    expect(screen.getByText("Day of Week")).toBeInTheDocument();
  });

  it("does not render a Chart/Table toggle without tableColumns", () => {
    render(
      <ReportsBreakdownCard
        title="Day of Week"
        breakdown={[grp("Monday", 200)]}
        loading={false}
        error={false}
        currency="USD"
      />,
    );
    expect(screen.queryByText("Table")).not.toBeInTheDocument();
  });
});

const testColumns: ColumnDef<BreakGroup>[] = [
  { accessorKey: "key", header: "Symbol", cell: (info) => info.getValue<string>() },
];

describe("ReportsBreakdownCard table toggle", () => {
  it("renders a Chart/Table toggle and switches views when tableColumns is provided", async () => {
    const user = userEvent.setup();
    render(
      <ReportsBreakdownCard
        title="Symbol"
        breakdown={[grp("AAPL", 200)]}
        loading={false}
        error={false}
        currency="USD"
        tableColumns={testColumns}
      />,
    );
    expect(screen.getByText("Table")).toBeInTheDocument();
    await user.click(screen.getByText("Table"));
    expect(screen.getByTestId("table")).toBeInTheDocument();
  });
});
