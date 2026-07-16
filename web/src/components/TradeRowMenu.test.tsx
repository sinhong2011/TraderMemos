import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import type { Trade } from "../lib/api/types";
import { TradeRowMenu } from "./TradeRowMenu";

vi.mock("./Toast", () => ({
  useToastManager: () => ({ add: vi.fn() }),
}));

const TRADE: Trade = {
  id: "t1",
  account_id: "a1",
  symbol: "CL8698",
  instrument_type: "futures",
  direction: "long",
  status: "closed",
  opened_at: "2026-07-02T13:00:00Z",
  closed_at: "2026-07-02T13:39:00Z",
  qty_opened: 1,
  qty_remaining: 0,
  avg_entry_price: 100,
  avg_exit_price: 110,
  gross_pnl: 10,
  fees_total: 1,
  net_pnl: 9,
  pnl_currency: "USD",
  return_pct: 9,
  time_in_trade_secs: 2340,
  notes: "",
  tags: [],
};

describe("TradeRowMenu", () => {
  it("opens a menu with drawer, full page, copy, and filter actions", async () => {
    const onOpenDrawer = vi.fn();
    const onOpenFullPage = vi.fn();
    const onFilterSymbol = vi.fn();
    const user = userEvent.setup();

    render(
      <TradeRowMenu trade={TRADE} actions={{ onOpenDrawer, onOpenFullPage, onFilterSymbol }} />,
    );

    await user.click(screen.getByRole("button", { name: "Actions for CL8698" }));

    expect(screen.getByRole("button", { name: /open drawer/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open full page/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy symbol/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /filter by CL8698/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /open full page/i }));
    expect(onOpenFullPage).toHaveBeenCalledWith(TRADE);
  });

  it("hides drawer and filter when handlers are omitted", async () => {
    const user = userEvent.setup();
    render(<TradeRowMenu trade={TRADE} actions={{ onOpenFullPage: vi.fn() }} />);

    await user.click(screen.getByRole("button", { name: "Actions for CL8698" }));

    expect(screen.queryByRole("button", { name: /open drawer/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /filter by/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open full page/i })).toBeInTheDocument();
  });
});
