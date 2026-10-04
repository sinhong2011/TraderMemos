import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import type { Trade } from "@/lib/api/types";
import { OpenPositionsCard } from "./OpenPositionsCard";

const trade = (over: Partial<Trade>): Trade => ({
  id: "t1",
  account_id: "a1",
  symbol: "NVDA",
  instrument_type: "stock",
  direction: "long",
  status: "open",
  opened_at: "2026-10-03T16:00:00Z",
  closed_at: null,
  qty_opened: 20,
  qty_remaining: 20,
  avg_entry_price: 180,
  avg_exit_price: null,
  gross_pnl: null,
  fees_total: 0,
  net_pnl: null,
  pnl_currency: "USD",
  return_pct: null,
  time_in_trade_secs: null,
  notes: "",
  tags: [],
  ...over,
});

const props = {
  loading: false,
  error: false,
  currency: "USD",
  onSelect: vi.fn<(t: Trade) => void>(),
};

describe("OpenPositionsCard", () => {
  it("sums recorded risk and counts positions without a stop apart", () => {
    render(
      <OpenPositionsCard
        {...props}
        trades={[trade({ initial_risk: 100 }), trade({ id: "t2", symbol: "AMD" })]}
      />,
    );
    expect(screen.getByText("Open positions (2)")).toBeTruthy();
    expect(screen.getByText(/\$100\.00 at risk/)).toBeTruthy();
    expect(screen.getByText(/1 without a stop/)).toBeTruthy();
  });

  it("says when no position has a stop rather than showing zero risk", () => {
    render(<OpenPositionsCard {...props} trades={[trade({})]} />);
    expect(screen.getByText("No stops recorded")).toBeTruthy();
    expect(screen.queryByText(/at risk/)).toBeNull();
  });

  it("reads flat when nothing is open", () => {
    render(<OpenPositionsCard {...props} trades={[]} />);
    expect(screen.getByText("Flat. No open positions.")).toBeTruthy();
  });

  it("opens a position on click", () => {
    const onSelect = vi.fn<(t: Trade) => void>();
    render(<OpenPositionsCard {...props} onSelect={onSelect} trades={[trade({})]} />);
    fireEvent.click(screen.getByText("NVDA"));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "t1" }));
  });
});
