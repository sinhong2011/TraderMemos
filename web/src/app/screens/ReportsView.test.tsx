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
    const breakdownCard = screen.getByRole("heading", { name: "Breakdown" }).closest("section");
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
    // Selector-scoped: the Metric Evolution card's right-axis metric selector
    // also has "Profit Factor" / "Expectancy" options (as buttons), which a
    // plain text match would ambiguously match alongside the StatCard labels.
    expect(screen.getByText("Profit Factor", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText("Expectancy", { selector: "span" })).toBeInTheDocument();
  });
});
