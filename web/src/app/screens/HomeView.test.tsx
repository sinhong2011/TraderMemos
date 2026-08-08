import type { ColumnDef } from "@/lib/table";
import { flexRender, getCoreRowModel, useReactTable, type RowData } from "@/lib/table";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import type { Summary, Trade } from "@/lib/api/types";
import { HomeView } from "./HomeView";

vi.mock("../../components/Toast", () => ({
  useToastManager: () => ({ add: vi.fn<(...args: any[]) => any>() }),
}));

vi.mock("../../lib/hooks/useTradeDetail", () => ({
  useDeleteTrade: () => ({
    mutateAsync: vi.fn<(...args: any[]) => any>(),
    isPending: false,
  }),
}));

vi.mock("../../lib/hooks/useMoneyFx", () => ({
  useMoneyFx: (baseCurrency: string) => ({
    baseCurrency,
    displayCurrency: baseCurrency || "USD",
    currency: baseCurrency || "USD",
    rate: 1,
    toDisplay: (v: number) => v,
    isLoading: false,
    isError: false,
  }),
}));

// DailyLossCard fetches risk rules; no limit configured means it renders null.
vi.mock("../../lib/hooks/useRiskRules", () => ({
  useRiskRules: () => ({ data: undefined, isLoading: false, isError: false }),
}));

// PropStatusCard fetches prop status; unconfigured means it renders null.
vi.mock("../../lib/hooks/useProp", () => ({
  usePropStatus: () => ({ data: undefined, isLoading: false, isError: false }),
}));

// Mock DataTable: the real one uses a virtualizer that needs a sized container
// (absent in jsdom, so it renders zero rows). Mirrors
// src/components/tradeColumns.test.tsx, which hits the same jsdom gotcha.
vi.mock("../../components/DataTable", () => ({
  DataTable: function MockDataTable<T extends RowData>({
    columns,
    data,
  }: {
    columns: ColumnDef<T>[];
    data: T[];
  }) {
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
  // The API reports loss figures as positive magnitudes (analytics.Summarize).
  gross_profit: 69.48,
  gross_loss: 131.27,
  profit_factor: 0.53,
  expectancy: -15.45,
  avg_win: 34.74,
  avg_loss: 65.64,
  avg_trade: -15.45,
  largest_win: 58.09,
  largest_loss: 111.24,
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
  onSelectTrade: vi.fn<(...args: any[]) => any>(),
  onOpenFullPage: vi.fn<(...args: any[]) => any>(),
  onViewAllTrades: vi.fn<(...args: any[]) => any>(),
  onOpenCalendar: vi.fn<(...args: any[]) => any>(),
  onOpenReports: vi.fn<(...args: any[]) => any>(),
  calendarYear: 2026,
  calendarMonth: 7,
  dailyPnl: { "2026-07-02": 11.39 },
  dailyLoading: false,
  dailyError: false,
  breakdownDim: "day_of_week" as const,
  onBreakdownDimChange: vi.fn<(...args: any[]) => any>(),
  breakdown: [
    {
      key: "Wed",
      summary: {
        ...SUMMARY,
        net_pnl: 11.39,
      },
    },
  ],
  breakdownLoading: false,
  breakdownError: false,
  accountFunded: false,
  onImport: vi.fn<(...args: any[]) => any>(),
  onNewTrade: vi.fn<(...args: any[]) => any>(),
  goalYear: 2026,
  goalAmount: null,
  goalLoading: false,
  goalSaving: false,
  ytdNetPnl: undefined,
  ytdLoading: false,
  onSaveGoal: vi.fn<(...args: any[]) => any>(async () => {}),
  onClearGoal: vi.fn<(...args: any[]) => any>(async () => {}),
};

describe("HomeView", () => {
  it("renders the stats strip from the summary", () => {
    render(<HomeView {...BASE} />);
    expect(screen.getByText("Wins")).toBeInTheDocument();
    expect(screen.getByText("Losses")).toBeInTheDocument();
    expect(screen.getByText("Avg win")).toBeInTheDocument();
    expect(screen.getByText("Avg loss")).toBeInTheDocument();
    expect(screen.getByText(/Gross/)).toBeInTheDocument();
    expect(screen.getByText(/^Net$/)).toBeInTheDocument();
    expect(screen.getByText(/PF/)).toBeInTheDocument();
    // Gross must reconcile: gross - fees = net (-49.29 - 12.50 = -61.79), never the
    // sum of the win/loss buckets (+200.75).
    expect(screen.getByText("-$49.29")).toBeInTheDocument();
    expect(screen.getAllByText("0.53").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/-\$61\.79/).length).toBeGreaterThan(0);
  });

  it("renders recent trades with view-all action", async () => {
    const user = userEvent.setup();
    const onViewAllTrades = vi.fn<(...args: any[]) => any>();
    render(<HomeView {...BASE} onViewAllTrades={onViewAllTrades} />);
    expect(screen.getByText("Recent trades")).toBeInTheDocument();
    expect(screen.getAllByText("TSLQ").length).toBeGreaterThan(0);
    expect(screen.getByText("WIN")).toBeInTheDocument();
    expect(screen.getByText("1 trade")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /view all trades/i }));
    expect(onViewAllTrades).toHaveBeenCalledOnce();
  });

  it("renders insight bento panels", () => {
    render(<HomeView {...BASE} />);
    expect(screen.getByText("PnL quality")).toBeInTheDocument();
    expect(screen.getByText("Stability")).toBeInTheDocument();
    expect(screen.getByText("Time")).toBeInTheDocument();
    expect(screen.getByText("Expectancy")).toBeInTheDocument();
    expect(screen.getByText("Best streak")).toBeInTheDocument();
    expect(screen.getByText("Average hold")).toBeInTheDocument();
  });

  it("renders breakdown chart and mini calendar", async () => {
    const user = userEvent.setup();
    const onOpenCalendar = vi.fn<(...args: any[]) => any>();
    const onOpenReports = vi.fn<(...args: any[]) => any>();
    render(<HomeView {...BASE} onOpenCalendar={onOpenCalendar} onOpenReports={onOpenReports} />);
    expect(screen.getByText("Breakdown")).toBeInTheDocument();
    expect(screen.getByText("Month")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /full calendar/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /full calendar/i }));
    expect(onOpenCalendar).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: /reports/i }));
    expect(onOpenReports).toHaveBeenCalledOnce();
  });

  it("shows account contribution when multiple accounts have trades", () => {
    render(
      <HomeView
        {...BASE}
        accounts={[
          {
            id: "a1",
            user_id: "u",
            name: "Prop",
            broker: "x",
            account_type: "live",
            base_currency: "USD",
            starting_balance: 0,
            created_at: "2026-01-01",
          },
          {
            id: "a2",
            user_id: "u",
            name: "Personal",
            broker: "x",
            account_type: "live",
            base_currency: "USD",
            starting_balance: 0,
            created_at: "2026-01-01",
          },
        ]}
        trades={[TRADE, { ...TRADE, id: "t2", account_id: "a2", symbol: "ES", net_pnl: 50 }]}
      />,
    );
    expect(screen.getByText("Account contribution")).toBeInTheDocument();
    expect(screen.getByText("Prop")).toBeInTheDocument();
    expect(screen.getByText("Personal")).toBeInTheDocument();
  });

  it("caps recent trades and reports remaining count", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      ...TRADE,
      id: `t${i}`,
      symbol: i === 0 ? "TSLQ" : `SYM${i}`,
    }));
    render(<HomeView {...BASE} trades={many} />);
    expect(screen.getByText("Showing 10 of 12 trades")).toBeInTheDocument();
  });

  it("renders range segmented control", () => {
    render(<HomeView {...BASE} />);
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
      <HomeView
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
      <HomeView
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
      <HomeView
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
    const onImport = vi.fn<(...args: any[]) => any>();
    const onNewTrade = vi.fn<(...args: any[]) => any>();
    render(
      <HomeView
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
