import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import type { Trade } from "../lib/api/types";
import { TradeRowMenu } from "./TradeRowMenu";

const mutateAsync = vi.fn<(id: string) => Promise<void>>();

vi.mock("../lib/hooks/useTradeDetail", () => ({
  useDeleteTrade: () => ({
    mutateAsync,
    isPending: false,
  }),
}));

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

function renderMenu(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("TradeRowMenu", () => {
  it("opens a menu with drawer, full page, copy, filter, and remove actions", async () => {
    const onOpenDrawer = vi.fn<(trade: Trade) => void>();
    const onOpenFullPage = vi.fn<(trade: Trade) => void>();
    const onFilterSymbol = vi.fn<(symbol: string) => void>();
    const user = userEvent.setup();

    renderMenu(
      <TradeRowMenu trade={TRADE} actions={{ onOpenDrawer, onOpenFullPage, onFilterSymbol }} />,
    );

    await user.click(screen.getByRole("button", { name: "Actions for CL8698" }));

    expect(await screen.findByRole("menuitem", { name: /open drawer/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /open full page/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /copy symbol/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /filter by CL8698/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /^remove$/i })).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: /open full page/i }));
    expect(onOpenFullPage).toHaveBeenCalledWith(TRADE);
  });

  it("hides drawer and filter when handlers are omitted", async () => {
    const user = userEvent.setup();
    renderMenu(
      <TradeRowMenu trade={TRADE} actions={{ onOpenFullPage: vi.fn<(trade: Trade) => void>() }} />,
    );

    await user.click(screen.getByRole("button", { name: "Actions for CL8698" }));

    expect(screen.queryByRole("menuitem", { name: /open drawer/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /filter by/i })).not.toBeInTheDocument();
    expect(await screen.findByRole("menuitem", { name: /open full page/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /^remove$/i })).toBeInTheDocument();
  });

  it("removes a trade after typing the symbol to confirm", async () => {
    mutateAsync.mockResolvedValue(undefined);
    const onDeleted = vi.fn<(trade: Trade) => void>();
    const user = userEvent.setup();

    renderMenu(
      <TradeRowMenu
        trade={TRADE}
        actions={{
          onOpenFullPage: vi.fn<(trade: Trade) => void>(),
          onDeleted,
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Actions for CL8698" }));
    await user.click(await screen.findByRole("menuitem", { name: /^remove$/i }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    const confirm = screen.getByRole("textbox", { name: /type CL8698 to confirm/i });
    const removeBtn = screen.getByRole("button", { name: /^remove trade$/i });
    expect(removeBtn).toBeDisabled();

    await user.type(confirm, "CL8698");
    expect(removeBtn).toBeEnabled();

    await user.click(removeBtn);
    expect(mutateAsync).toHaveBeenCalledWith("t1");
    expect(onDeleted).toHaveBeenCalledWith(TRADE);
  });
});
