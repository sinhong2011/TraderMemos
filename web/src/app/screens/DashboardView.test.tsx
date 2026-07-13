import type { ColumnDef } from "@tanstack/react-table";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import type { Summary, Trade } from "../../lib/api/types";
import { DashboardView } from "./DashboardView";

// Mock DataTable: the real one uses a virtualizer that needs a sized container
// (absent in jsdom, so it renders zero rows). Mirrors
// src/components/tradeColumns.test.tsx, which hits the same jsdom gotcha.
vi.mock("../../components/DataTable", () => ({
  DataTable: function MockDataTable<T>({ columns, data }: { columns: ColumnDef<T>[]; data: T[] }) {
    const table = useReactTable({
      data,
      columns,
      getCoreRowModel: getCoreRowModel(),
    });

    return (
      <table>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  },
}));

const SUMMARY: Summary = {
  total_trades: 4,
  wins: 2,
  losses: 2,
  breakeven: 0,
  win_rate: 0.5,
  net_pnl: -61.79,
  gross_profit: 69.48,
  gross_loss: -131.27,
  profit_factor: 0.53,
  expectancy: -15.45,
  avg_win: 34.74,
  avg_loss: -65.64,
  avg_trade: -15.45,
  largest_win: 58.09,
  largest_loss: -111.24,
  total_fees: 12.5,
};

const TRADE: Trade = {
  id: "t1",
  account_id: "a1",
  symbol: "TSLQ",
  instrument_type: "stock",
  direction: "long",
  status: "closed",
  opened_at: "2026-07-02T13:00:00Z",
  closed_at: "2026-07-02T13:39:00Z",
  qty_opened: 80,
  qty_remaining: 0,
  avg_entry_price: 18.02,
  avg_exit_price: 18.23,
  gross_pnl: 16.8,
  fees_total: 5.41,
  net_pnl: 11.39,
  pnl_currency: "USD",
  return_pct: 0.79,
  time_in_trade_secs: 2340,
  notes: "",
  tags: [],
};

const BASE = {
  summaryLoading: false,
  summaryError: false,
  summary: SUMMARY,
  equityLoading: false,
  equityError: false,
  equityPoints: [
    { at: "2026-07-01T00:00:00Z", equity: -20.03 },
    { at: "2026-07-02T00:00:00Z", equity: -61.79 },
  ],
  tradesLoading: false,
  tradesError: false,
  trades: [TRADE],
  accounts: [],
  selectedAccountId: undefined,
  onSelectTrade: vi.fn(),
  accountFunded: false,
  onImport: vi.fn(),
  onNewTrade: vi.fn(),
};

describe("DashboardView", () => {
  it("renders the stats strip from the summary", () => {
    render(<DashboardView {...BASE} />);
    expect(screen.getByText("WINS")).toBeInTheDocument();
    expect(screen.getByText("LOSSES")).toBeInTheDocument();
    expect(screen.getByText("AVG W")).toBeInTheDocument();
    expect(screen.getByText("AVG L")).toBeInTheDocument();
    expect(screen.getByText(/Gross/)).toBeInTheDocument();
    expect(screen.getByText(/-\$61\.79/)).toBeInTheDocument();
  });

  it("renders the trades table with the loaded footer", () => {
    render(<DashboardView {...BASE} />);
    expect(screen.getByText("TSLQ")).toBeInTheDocument();
    expect(screen.getByText("WIN")).toBeInTheDocument();
    expect(screen.getByText("All 1 trades loaded")).toBeInTheDocument();
  });

  it("renders range segmented control", () => {
    render(<DashboardView {...BASE} />);
    expect(screen.getByRole("button", { name: "30D" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ALL" })).toBeInTheDocument();
  });

  it("computes OPEN percentage against all trades, not closed-only total", () => {
    const openTrade: Trade = {
      ...TRADE,
      id: "t2",
      status: "open",
      closed_at: null,
      net_pnl: null,
      avg_exit_price: null,
      return_pct: null,
      time_in_trade_secs: null,
    };
    // Two open trades, zero closed: the closed-only total would yield
    // 2 / max(0, 1) = 200%; against all trades it is 2 / 2 = 100%.
    render(
      <DashboardView
        {...BASE}
        summary={{ ...SUMMARY, total_trades: 0, wins: 0, losses: 0 }}
        trades={[openTrade, { ...openTrade, id: "t3" }]}
      />,
    );
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.queryByText("200%")).toBeNull();
  });

  it("shows the empty state with onboarding actions", () => {
    render(
      <DashboardView
        {...BASE}
        summary={{ ...SUMMARY, total_trades: 0 }}
        trades={[]}
        equityPoints={[]}
      />,
    );
    expect(screen.getByText("No trades yet")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Import broker history or log your first trade to start tracking performance/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /import csv/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /log trade/i })).toBeInTheDocument();
  });

  it("shows funded-account hint when account has cash", () => {
    render(
      <DashboardView
        {...BASE}
        summary={{ ...SUMMARY, total_trades: 0 }}
        trades={[]}
        equityPoints={[]}
        accountFunded
      />,
    );
    expect(
      screen.getByText(
        /Account funded — import history or log your first trade to see P&L light up here/i,
      ),
    ).toBeInTheDocument();
  });

  it("wires empty-state actions", async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();
    const onNewTrade = vi.fn();
    render(
      <DashboardView
        {...BASE}
        summary={{ ...SUMMARY, total_trades: 0 }}
        trades={[]}
        equityPoints={[]}
        onImport={onImport}
        onNewTrade={onNewTrade}
      />,
    );
    await user.click(screen.getByRole("button", { name: /import csv/i }));
    await user.click(screen.getByRole("button", { name: /log trade/i }));
    expect(onImport).toHaveBeenCalledOnce();
    expect(onNewTrade).toHaveBeenCalledOnce();
  });
});
