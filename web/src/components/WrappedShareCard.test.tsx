import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vite-plus/test";
import type { Trade } from "@/lib/api/types";
import { computeYearWrapped } from "@/lib/wrapped";
import { Toaster } from "@/components/Toaster";
import { WrappedShareModal } from "./WrappedShareCard";

function trade(over: Partial<Trade>): Trade {
  return {
    id: "t1",
    account_id: "a1",
    symbol: "NQ",
    instrument_type: "future",
    direction: "long",
    status: "closed",
    opened_at: "2025-07-01T10:00:00Z",
    closed_at: "2025-07-01T11:00:00Z",
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

const wrapped = computeYearWrapped(
  [
    trade({ id: "1", closed_at: "2025-01-05T12:00:00Z", net_pnl: 300 }),
    trade({ id: "2", closed_at: "2025-03-10T12:00:00Z", net_pnl: -100, symbol: "ES" }),
  ],
  2025,
);

function renderModal() {
  return render(
    <Toaster>
      <WrappedShareModal
        wrapped={wrapped}
        currency="USD"
        fxRate={1}
        inProgress={false}
        open
        onOpenChange={() => {}}
      />
    </Toaster>,
  );
}

describe("WrappedShareModal", () => {
  it("renders a privacy-first card: win-rate hero, no dollar values", () => {
    renderModal();
    const svg = screen.getByRole("img", { name: "2025 Wrapped share card" });
    expect(svg).toBeInTheDocument();
    expect(svg.textContent).toContain("50%");
    expect(svg.textContent).toContain("GREEN YEAR");
    expect(svg.textContent).not.toContain("$");
    expect(screen.getByRole("button", { name: "Download PNG" })).toBeInTheDocument();
  });

  it("opts into dollar amounts via the switch", async () => {
    renderModal();
    const user = userEvent.setup();
    await user.click(screen.getByRole("switch", { name: /show dollar amounts/i }));
    const svg = screen.getByRole("img", { name: "2025 Wrapped share card" });
    expect(svg.textContent).toContain("+$200.00");
    expect(svg.textContent).toContain("50%"); // win rate demoted to the stat row
  });
});
