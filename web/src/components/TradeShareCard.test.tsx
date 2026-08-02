import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vite-plus/test";
import type { TradeDetail } from "@/lib/api/types";
import { computeTradeInsights } from "@/lib/tradeInsights";
import { Toaster } from "@/components/Toaster";
import { TradeShareModal } from "./TradeShareCard";

const trade: TradeDetail = {
  id: "t1",
  account_id: "a1",
  symbol: "NVDA",
  instrument_type: "stock",
  direction: "long",
  status: "closed",
  opened_at: "2026-07-30T14:30:00Z",
  closed_at: "2026-07-30T15:15:00Z",
  qty_opened: 100,
  qty_remaining: 0,
  avg_entry_price: 100,
  avg_exit_price: 104,
  gross_pnl: 400,
  fees_total: 4,
  net_pnl: 396,
  pnl_currency: "USD",
  return_pct: 3.96,
  time_in_trade_secs: 2700,
  notes: "",
  tags: [],
  fills: [],
  setup: null,
  setup_ids: [],
  initial_risk: 200,
  target_price: null,
  stop_price: null,
  r_multiple: 1.98,
  emotional_state: "",
  confidence: null,
  trade_quality: null,
  mae: null,
  mfe: null,
  post_exit_mae: null,
  post_exit_mfe: null,
  dividend_total: 0,
  total_pnl: 396,
  attachments: [],
};

function renderModal() {
  return render(
    <Toaster>
      <TradeShareModal
        trade={trade}
        insights={computeTradeInsights(trade)}
        open
        onOpenChange={() => {}}
      />
    </Toaster>,
  );
}

describe("TradeShareModal", () => {
  it("renders a privacy-first card: R hero, no dollar values", () => {
    renderModal();
    const svg = screen.getByRole("img", { name: "NVDA trade card" });
    expect(svg).toBeInTheDocument();
    expect(svg.textContent).toContain("+1.98R");
    expect(svg.textContent).not.toContain("$");
    expect(screen.getByRole("button", { name: "Download PNG" })).toBeInTheDocument();
  });

  it("opts into dollar amounts via the switch", async () => {
    renderModal();
    const user = userEvent.setup();
    await user.click(screen.getByRole("switch", { name: /show dollar amounts/i }));
    const svg = screen.getByRole("img", { name: "NVDA trade card" });
    expect(svg.textContent).toContain("+$396.00");
    expect(svg.textContent).toContain("+1.98R"); // R demoted to the stat row
  });
});
