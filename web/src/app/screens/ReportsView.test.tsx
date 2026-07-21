import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import type { BreakGroup } from "../../lib/api/types";
import { ReportsView } from "./ReportsView";

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
  onTabChange: vi.fn(),
  currency: "USD",
  onDimChange: vi.fn(),
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
    expect(screen.queryByText("Session")).not.toBeInTheDocument();
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

  it("calls onTabChange when a tab is clicked", async () => {
    const onTabChange = vi.fn();
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
