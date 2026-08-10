import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import type { PublicShareSummary } from "@/lib/api/share";
import { renderWithI18n } from "@/test/renderWithI18n";
import { PublicShareView } from "./PublicShareView";

const shared: PublicShareSummary = {
  summary: {
    total_trades: 5,
    wins: 3,
    losses: 2,
    breakeven: 0,
    win_rate: 0.6,
    profit_factor: 2.3,
    kelly_pct: 18.5,
    sqn: 1.4,
    net_pnl: 180,
    gross_profit: 230,
    gross_loss: 50,
    expectancy: 36,
    avg_win: 76.67,
    avg_loss: 25,
    avg_trade: 36,
    largest_win: 100,
    largest_loss: 30,
    total_fees: 5,
  },
  equity: [
    { at: "2026-03-02T15:00:00Z", value: 100 },
    { at: "2026-03-03T15:00:00Z", value: 150 },
    { at: "2026-04-01T15:00:00Z", value: 180 },
  ],
  months: [
    { month: "2026-03", trades: 4, pnl: 100 },
    { month: "2026-04", trades: 1, pnl: 80 },
  ],
  top_symbols: [{ symbol: "AAPL", trades: 2, pnl: 150 }],
  trading_days: 5,
  green_days: 3,
  red_days: 2,
  best_streak: 2,
  worst_streak: 2,
  first_day: "2026-03-02",
  last_day: "2026-04-01",
  best_day_pnl: 100,
  worst_day_pnl: -30,
  show_amounts: true,
  currency: "USD",
};

const usePublicShare = vi.hoisted(() => vi.fn());
vi.mock("../../lib/hooks/useShareLinks", () => ({ usePublicShare }));

function mockResult(data: PublicShareSummary | undefined, isError = false) {
  usePublicShare.mockReturnValue({ data, isPending: false, isError });
}

describe("PublicShareView", () => {
  it("renders the shared record with amounts", () => {
    mockResult(shared);
    renderWithI18n(<PublicShareView token="tok" />);
    expect(screen.getByText("Shared performance record")).toBeInTheDocument();
    expect(screen.getByText("+$180.00")).toBeInTheDocument();
    expect(screen.getByText("2.30")).toBeInTheDocument();
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByText("2026-03-02 — 2026-04-01")).toBeInTheDocument();
    expect(screen.getByText("Cumulative net P&L over the shared period.")).toBeInTheDocument();
  });

  it("keeps money off the page when amounts are hidden", () => {
    mockResult({
      ...shared,
      show_amounts: false,
      currency: undefined,
      summary: {
        ...shared.summary,
        net_pnl: undefined,
        expectancy: undefined,
        gross_profit: undefined,
        gross_loss: undefined,
        avg_win: undefined,
        avg_loss: undefined,
        avg_trade: undefined,
        largest_win: undefined,
        largest_loss: undefined,
        total_fees: undefined,
      },
      months: shared.months.map((m) => ({ month: m.month, trades: m.trades })),
      top_symbols: [{ symbol: "AAPL", trades: 2 }],
      best_day_pnl: undefined,
      worst_day_pnl: undefined,
      equity: [
        { at: "2026-03-02T15:00:00Z", value: 0.55 },
        { at: "2026-04-01T15:00:00Z", value: 1 },
      ],
    });
    renderWithI18n(<PublicShareView token="tok" />);
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
    // Win rate becomes the hero and appears in the donut too.
    expect(screen.getAllByText("60%").length).toBeGreaterThan(0);
    expect(screen.getByText("Cumulative P&L shape — amounts are not shared.")).toBeInTheDocument();
  });

  it("shows the unavailable state on error", () => {
    mockResult(undefined, true);
    renderWithI18n(<PublicShareView token="tok" />);
    expect(screen.getByText("This link isn't available")).toBeInTheDocument();
  });
});
