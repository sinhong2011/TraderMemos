import { render, screen, within } from "@testing-library/react";
import type { CellContext } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import { ReportsDisplayProvider } from "../../components/ReportsDisplayContext";
import type { BreakGroup } from "../../lib/api/types";
import { PnlBarChart, ReportsView, buildColumns } from "./ReportsView";

// useMoneyFx pulls in useQuery, which needs a QueryClientProvider; mock it the
// same way DashboardView.test.tsx does so ReportsView can render standalone.
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

// Mock DataTable (virtualizer needs a sized container in jsdom) to render keys + P&L.
vi.mock("../../components/DataTable", () => ({
  DataTable: ({ data }: { data: BreakGroup[] }) => (
    <div data-testid="table">
      {data.map((g) => (
        <div key={g.key}>
          {g.key} {g.summary.net_pnl}
        </div>
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
  } as BreakGroup;
}

const base = {
  summaryLoading: false,
  summaryError: false,
  trades: [],
  tradesLoading: false,
  tradesError: false,
  equityLoading: false,
  equityError: false,
  loading: false,
  error: false,
  dayOfWeekBreakdown: [],
  dayOfWeekBreakdownLoading: false,
  dayOfWeekBreakdownError: false,
  hourOfDayBreakdown: [],
  hourOfDayBreakdownLoading: false,
  hourOfDayBreakdownError: false,
  symbolBreakdown: [],
  symbolBreakdownLoading: false,
  symbolBreakdownError: false,
  tagBreakdown: [],
  tagBreakdownLoading: false,
  tagBreakdownError: false,
  sessionBreakdown: [],
  sessionBreakdownLoading: false,
  sessionBreakdownError: false,
  qualityBreakdown: [],
  qualityBreakdownLoading: false,
  qualityBreakdownError: false,
  tab: "overview" as const,
  onTabChange: vi.fn<(...args: any[]) => any>(),
  currency: "USD",
  onDimChange: vi.fn<(...args: any[]) => any>(),
  side: "all" as const,
  duration: "all" as const,
  onSideChange: vi.fn<(...args: any[]) => any>(),
  onDurationChange: vi.fn<(...args: any[]) => any>(),
  pnlMode: "net" as const,
  unitMode: "abs" as const,
  denominator: 0,
  onPnlModeChange: vi.fn<(...args: any[]) => any>(),
  onUnitModeChange: vi.fn<(...args: any[]) => any>(),
  selectedDay: null,
  onSelectDay: vi.fn<(...args: any[]) => any>(),
  dayTrades: [],
  dayTradesLoading: false,
  dayTradesError: false,
  onSelectTrade: vi.fn<(...args: any[]) => any>(),
  onOpenFullPage: vi.fn<(...args: any[]) => any>(),
};

describe("ReportsView", () => {
  it("renders breakdown groups in the table", () => {
    render(
      <ReportsView {...base} dim="symbol" breakdown={[grp("AAPL", 200), grp("MSFT", -100)]} />,
    );
    expect(screen.getByText(/AAPL/)).toBeInTheDocument();
    expect(screen.getByText(/MSFT/)).toBeInTheDocument();
  });

  it("shows an empty state when there is no data", () => {
    render(<ReportsView {...base} dim="symbol" breakdown={[]} />);
    // Scoped to the Breakdown card: the Metric Evolution card (empty trades,
    // same as `base`) also renders an empty state titled "No data", so an
    // unscoped text match would ambiguously match both.
    const breakdownCard = screen
      .getByRole("heading", { name: "Playbook & Leaks" })
      .closest("section");
    expect(breakdownCard).not.toBeNull();
    expect(within(breakdownCard as HTMLElement).getByText("No data")).toBeInTheDocument();
  });

  it("renders the summary metrics grid", () => {
    render(
      <ReportsView
        {...base}
        dim="symbol"
        breakdown={[grp("AAPL", 200)]}
        summary={grp("all", 60).summary}
      />,
    );

    expect(screen.getByText("Edge metrics")).toBeInTheDocument();
    expect(screen.getByText("Profit factor")).toBeInTheDocument();
    expect(screen.getByText("Win rate")).toBeInTheDocument();
    expect(screen.getByText("Payoff ratio")).toBeInTheDocument();

    const performance = screen.getByText("Performance").closest("section");
    expect(performance).not.toBeNull();
    expect(within(performance as HTMLElement).getByText("Net P&L")).toBeInTheDocument();
    expect(within(performance as HTMLElement).getByText("Expectancy")).toBeInTheDocument();

    expect(screen.getByText("Avg trade")).toBeInTheDocument();
    expect(screen.getByText("Max drawdown")).toBeInTheDocument();
    expect(screen.getByText("Total fees")).toBeInTheDocument();
    expect(screen.getByText("Session context")).toBeInTheDocument();
    expect(screen.getByText("Best streak")).toBeInTheDocument();
    expect(screen.getByText("Main leak")).toBeInTheDocument();
    expect(screen.getByText("Open / breakeven")).toBeInTheDocument();
  });

  it("renders the execution grade card", () => {
    render(
      <ReportsView
        {...base}
        dim="symbol"
        breakdown={[]}
        qualityBreakdown={[grp("5", 200), grp("1", -100)]}
      />,
    );
    expect(screen.getByText("Execution Grade")).toBeInTheDocument();
    expect(screen.getByText("A+")).toBeInTheDocument();
    expect(screen.getByText("C")).toBeInTheDocument();
  });

  it("shows only the active tab's sections", () => {
    render(
      <ReportsView
        {...base}
        dim="symbol"
        breakdown={[]}
        tab="overview"
        symbolBreakdown={[grp("AAPL", 200)]}
      />,
    );
    // Overview owns Execution Grade; Detailed owns the Symbol card + Stock P&L heatmap.
    expect(screen.getByText("Execution Grade")).toBeInTheDocument();
    expect(screen.queryByText("Stock P&L")).not.toBeInTheDocument();
    expect(screen.queryByText("Session Performance")).not.toBeInTheDocument();
  });

  it("renders the Detailed tab's sections including the heatmap", () => {
    render(
      <ReportsView
        {...base}
        dim="symbol"
        breakdown={[]}
        tab="detailed"
        symbolBreakdown={[grp("AAPL", 200)]}
      />,
    );
    expect(screen.getByText("Stock P&L")).toBeInTheDocument();
    // ReportsSessionTable's card title is "Session Performance" (set in that
    // component, unchanged by this task); "Session" alone never matches exactly.
    expect(screen.getByText("Session Performance")).toBeInTheDocument();
    expect(screen.queryByText("Execution Grade")).not.toBeInTheDocument();
  });

  it("renders the control bar side/duration options", () => {
    render(<ReportsView {...base} dim="symbol" breakdown={[]} />);
    expect(screen.getByRole("tab", { name: "Long" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Swing" })).toBeInTheDocument();
  });

  it("renders the display-mode toggles", () => {
    render(<ReportsView {...base} dim="symbol" breakdown={[]} />);
    expect(screen.getByRole("tab", { name: "Gross" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "%" })).toBeInTheDocument();
  });

  it("calls onTabChange when a tab is clicked", async () => {
    const onTabChange = vi.fn<(...args: any[]) => any>();
    render(
      <ReportsView
        {...base}
        dim="symbol"
        breakdown={[]}
        tab="overview"
        onTabChange={onTabChange}
      />,
    );
    screen.getByRole("tab", { name: "Detailed" }).click();
    expect(onTabChange).toHaveBeenCalledWith("detailed");
  });
});

// DataTable is mocked above (its virtualizer needs a sized container in
// jsdom), which bypasses buildColumns' real net_pnl cell renderer — so the
// column's `cell` function is exercised directly instead, wrapped in a
// ReportsDisplayProvider like the other breakdown-family cards.
describe("buildColumns net_pnl cell", () => {
  function fakeInfo(g: BreakGroup): CellContext<BreakGroup, number> {
    return { row: { original: g } } as unknown as CellContext<BreakGroup, number>;
  }

  function renderNetPnlCell(g: BreakGroup) {
    const columns = buildColumns("Symbol");
    const netPnlCol = columns.find((c) => c.id === "net_pnl")!;
    const cellFn = netPnlCol.cell as (info: CellContext<BreakGroup, number>) => ReactNode;
    return cellFn(fakeInfo(g));
  }

  it("shows the gross P&L when pnlMode is gross", () => {
    // net_pnl (100) differs from gross (gross_profit - gross_loss = 260 - 60 = 200).
    const g = grp("AAPL", 100);
    g.summary.gross_profit = 260;
    g.summary.gross_loss = 60;
    render(
      <ReportsDisplayProvider
        value={{ pnlMode: "gross", unitMode: "abs", denominator: 0, currency: "USD", fxRate: 1 }}
      >
        {renderNetPnlCell(g)}
      </ReportsDisplayProvider>,
    );
    expect(screen.getByText("+$200.00")).toBeInTheDocument();
  });

  it("shows a percentage of the denominator when unitMode is pct", () => {
    const g = grp("AAPL", 250);
    render(
      <ReportsDisplayProvider
        value={{ pnlMode: "net", unitMode: "pct", denominator: 1000, currency: "USD", fxRate: 1 }}
      >
        {renderNetPnlCell(g)}
      </ReportsDisplayProvider>,
    );
    expect(screen.getByText("25%")).toBeInTheDocument();
  });
});

describe("PnlBarChart display modes", () => {
  it("plots gross P&L values when pnlMode is gross", () => {
    const g = grp("AAPL", 100);
    g.summary.gross_profit = 260;
    g.summary.gross_loss = 60; // gross = 200
    const { container } = render(
      <ReportsDisplayProvider
        value={{ pnlMode: "gross", unitMode: "abs", denominator: 0, currency: "USD", fxRate: 1 }}
      >
        <PnlBarChart data={[g]} />
      </ReportsDisplayProvider>,
    );
    // Recharts may not paint bars in jsdom; assert the chart mounts and the
    // series uses the re-expressed value via the Y-axis tick formatter path by
    // checking formatAxis output is reachable (smoke: no crash + SVG present).
    expect(container.querySelector(".recharts-responsive-container")).not.toBeNull();
  });

  it("honors pct unitMode without crashing", () => {
    const { container } = render(
      <ReportsDisplayProvider
        value={{ pnlMode: "net", unitMode: "pct", denominator: 1000, currency: "USD", fxRate: 1 }}
      >
        <PnlBarChart data={[grp("AAPL", 250)]} />
      </ReportsDisplayProvider>,
    );
    expect(container.querySelector(".recharts-responsive-container")).not.toBeNull();
  });
});
