import { describe, expect, it } from "vite-plus/test";
import type { TradeDetail } from "./api/types";
import { buildTradeShareCard } from "./shareCard";
import { computeTradeInsights } from "./tradeInsights";

function trade(over: Partial<TradeDetail> = {}): TradeDetail {
  return {
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
    ...over,
  };
}

function card(t: TradeDetail, showAmounts = false) {
  return buildTradeShareCard(t, computeTradeInsights(t), { showAmounts, locale: "en-US" });
}

describe("buildTradeShareCard", () => {
  it("defaults to R-multiple hero with no dollar amounts anywhere", () => {
    const c = card(trade());
    expect(c.hero).toEqual({ label: "R multiple", value: "+1.98R" });
    expect(c.outcome).toBe("WIN");
    expect(c.tone).toBe("profit");
    const all = [c.hero.value, ...c.stats.map((s) => s.value)].join(" ");
    expect(all).not.toMatch(/\$/);
    expect(c.stats.map((s) => s.label)).toContain("Return");
  });

  it("shows net P&L as hero when amounts are opted in, keeping R as a stat", () => {
    const c = card(trade(), true);
    expect(c.hero.label).toBe("Net P&L");
    expect(c.hero.value).toContain("$");
    expect(c.stats.some((s) => s.label === "R multiple" && s.value === "+1.98R")).toBe(true);
  });

  it("falls back to return % when no R multiple exists", () => {
    const c = card(trade({ r_multiple: null, initial_risk: null }));
    expect(c.hero).toEqual({ label: "Return", value: "+3.96%" });
    // Return is the hero, so it does not repeat in the stat row.
    expect(c.stats.some((s) => s.label === "Return")).toBe(false);
  });

  it("marks losses and open trades", () => {
    const loss = card(trade({ net_pnl: -120, r_multiple: -0.6 }));
    expect(loss.outcome).toBe("LOSS");
    expect(loss.tone).toBe("loss");
    expect(loss.hero.value).toBe("-0.60R");

    const open = card(trade({ status: "open", closed_at: null, r_multiple: null }));
    expect(open.outcome).toBe("OPEN");
    expect(open.tone).toBe("flat");
  });

  it("uses the close date and short direction label", () => {
    const c = card(trade({ direction: "short" }));
    expect(c.directionLabel).toBe("SHORT");
    expect(c.dateLabel).toMatch(/Jul 30, 2026/);
  });
});
