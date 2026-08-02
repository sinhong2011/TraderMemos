import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import type { ReactNode } from "react";
import type { Trade } from "@/lib/api/types";
import { computeYearWrapped } from "@/lib/wrapped";
import { YearWrappedView } from "./YearWrappedView";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="#mock">{children}</a>,
}));

function trade(over: Partial<Trade>): Trade {
  return {
    id: "t1",
    account_id: "a1",
    symbol: "NQ",
    instrument_type: "future",
    direction: "long",
    status: "closed",
    opened_at: "2026-07-01T10:00:00Z",
    closed_at: "2026-07-01T11:00:00Z",
    qty_opened: 1,
    qty_remaining: 0,
    avg_entry_price: 100,
    avg_exit_price: 110,
    gross_pnl: 10,
    fees_total: 0,
    net_pnl: 10,
    pnl_currency: "USD",
    return_pct: 0.1,
    time_in_trade_secs: 3600,
    notes: "",
    tags: [],
    ...over,
  };
}

const baseProps = {
  loading: false,
  error: false,
  year: 2026,
  currentYear: 2026,
  onYearChange: vi.fn<(y: number) => void>(),
  currency: "USD",
  fxRate: 1,
};

describe("YearWrappedView", () => {
  it("renders the hero and all recap sections", () => {
    const trades = [
      trade({ id: "1", closed_at: "2026-01-05T12:00:00Z", net_pnl: 100 }),
      trade({ id: "2", closed_at: "2026-03-10T12:00:00Z", net_pnl: 250, symbol: "ES" }),
      trade({ id: "3", closed_at: "2026-03-11T12:00:00Z", net_pnl: -50 }),
    ];
    const wrapped = computeYearWrapped(trades, 2026);
    render(<YearWrappedView {...baseProps} wrapped={wrapped} />);

    expect(screen.getByText("2026 Wrapped")).toBeInTheDocument();
    expect(screen.getByText("+$300.00")).toBeInTheDocument();
    expect(screen.getByText(/3 trades/)).toBeInTheDocument();
    expect(screen.getByText("The highs")).toBeInTheDocument();
    expect(screen.getByText("The lessons")).toBeInTheDocument();
    expect(screen.getByText("Your rhythm")).toBeInTheDocument();
    expect(screen.getByText("Your habits")).toBeInTheDocument();
    expect(screen.getByText("Bottom line")).toBeInTheDocument();
    // Biggest win detail
    expect(screen.getByText("ES · 2026-03-10")).toBeInTheDocument();
    // Busiest month callout (label also appears under the month bars)
    expect(screen.getAllByText("Mar").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Busiest month:/)).toBeInTheDocument();
  });

  it("shows an empty state when the year has no closed trades", () => {
    const wrapped = computeYearWrapped([], 2026);
    render(<YearWrappedView {...baseProps} wrapped={wrapped} />);
    expect(screen.getByText("No closed trades in 2026")).toBeInTheDocument();
  });

  it("disables the next-year arrow at the current year", () => {
    const wrapped = computeYearWrapped([], 2026);
    render(<YearWrappedView {...baseProps} wrapped={wrapped} />);
    expect(screen.getByRole("button", { name: "Next year" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous year" })).toBeEnabled();
  });
});
