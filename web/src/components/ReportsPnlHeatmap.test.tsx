import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import { ReportsPnlHeatmap } from "./ReportsPnlHeatmap";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Trade } from "@/lib/api/types";

function trade(over: Partial<Trade>): Trade {
  return {
    id: "t1",
    account_id: "a1",
    symbol: "NQ",
    instrument_type: "future",
    direction: "long",
    status: "closed",
    opened_at: "2026-01-05T15:30:00Z",
    closed_at: "2026-01-05T16:00:00Z",
    qty_opened: 1,
    qty_remaining: 0,
    avg_entry_price: 100,
    avg_exit_price: 110,
    gross_pnl: 10,
    fees_total: 0,
    net_pnl: 10,
    pnl_currency: "USD",
    return_pct: 0.1,
    time_in_trade_secs: 1800,
    notes: "",
    tags: [],
    ...over,
  };
}

function renderCard(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

const baseProps = { loading: false, error: false };

describe("ReportsPnlHeatmap", () => {
  it("renders traded cells with accessible labels", () => {
    renderCard(
      <ReportsPnlHeatmap
        {...baseProps}
        trades={[
          trade({ net_pnl: 150 }),
          trade({ id: "2", opened_at: "2026-01-06T15:30:00Z", net_pnl: -60 }),
        ]}
      />,
    );
    // 2026-01-05 is a Monday; 15:30Z is 10:30 ET (winter, UTC-5).
    expect(screen.getByLabelText("Mon 10:00 — +$150.00 · 1 trade")).toBeInTheDocument();
    expect(screen.getByLabelText("Tue 10:00 — -$60.00 · 1 trade")).toBeInTheDocument();
  });

  it("shows a tooltip with the cell numbers on hover", async () => {
    const user = userEvent.setup();
    renderCard(<ReportsPnlHeatmap {...baseProps} trades={[trade({ net_pnl: 150 })]} />);
    await user.hover(screen.getByLabelText("Mon 10:00 — +$150.00 · 1 trade"));
    expect(await screen.findByText("Mon 10:00")).toBeInTheDocument();
    expect(screen.getByText("+$150.00")).toBeInTheDocument();
  });

  it("opens cell details on click and drills into a trade", async () => {
    const user = userEvent.setup();
    const onSelectTradeId = vi.fn();
    renderCard(
      <ReportsPnlHeatmap
        {...baseProps}
        trades={[
          trade({ id: "a", symbol: "NQ", net_pnl: 150 }),
          trade({ id: "b", symbol: "ES", opened_at: "2026-01-12T15:45:00Z", net_pnl: -50 }),
        ]}
        onSelectTradeId={onSelectTradeId}
      />,
    );
    await user.click(screen.getByLabelText("Mon 10:00 — +$100.00 · 2 trades"));
    expect(await screen.findByText("Mon · 10:00–11:00")).toBeInTheDocument();
    expect(screen.getByText("1W · 1L · 50% win")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /ES/ }));
    expect(onSelectTradeId).toHaveBeenCalledWith("b");
  });

  it("shows an empty state without closed trades", () => {
    renderCard(<ReportsPnlHeatmap {...baseProps} trades={[]} />);
    expect(screen.getByText("No closed trades yet")).toBeInTheDocument();
  });
});
