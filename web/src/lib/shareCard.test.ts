import { describe, expect, it } from "vite-plus/test";
import type { Trade, TradeDetail } from "./api/types";
import { buildTradeShareCard, buildWrappedShareCard } from "./shareCard";
import { computeTradeInsights } from "./tradeInsights";
import { computeYearWrapped } from "./wrapped";

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
    expect(c.chips[1]).toEqual({ text: "WIN", tone: "profit" });
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
    expect(loss.chips[1]).toEqual({ text: "LOSS", tone: "loss" });
    expect(loss.tone).toBe("loss");
    expect(loss.hero.value).toBe("-0.60R");

    const open = card(trade({ status: "open", closed_at: null, r_multiple: null }));
    expect(open.chips[1]).toEqual({ text: "OPEN", tone: "brand" });
    expect(open.tone).toBe("flat");
  });

  it("uses the close date and short direction label", () => {
    const c = card(trade({ direction: "short" }));
    expect(c.chips[0]).toEqual({ text: "SHORT", tone: "muted" });
    expect(c.dateLabel).toMatch(/Jul 30, 2026/);
  });
});

function yearTrade(over: Partial<Trade>): Trade {
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

describe("buildWrappedShareCard", () => {
  const wrapped = computeYearWrapped(
    [
      yearTrade({ id: "1", closed_at: "2025-01-05T12:00:00Z", net_pnl: 100 }),
      yearTrade({ id: "2", closed_at: "2025-03-10T12:00:00Z", net_pnl: 250, symbol: "ES" }),
      yearTrade({ id: "3", closed_at: "2025-03-11T12:00:00Z", net_pnl: -50 }),
      yearTrade({ id: "4", closed_at: "2025-04-02T12:00:00Z", net_pnl: -100 }),
    ],
    2025,
  );

  function card(
    showAmounts = false,
    over: Partial<Parameters<typeof buildWrappedShareCard>[1]> = {},
  ) {
    return buildWrappedShareCard(wrapped, {
      showAmounts,
      locale: "en-US",
      currency: "USD",
      fxRate: 1,
      ...over,
    });
  }

  it("defaults to a win-rate hero with no dollar amounts anywhere", () => {
    const c = card();
    expect(c.title).toBe("2025 Wrapped");
    expect(c.hero).toEqual({ label: "Win rate", value: "50%" });
    expect(c.tone).toBe("profit");
    expect(c.chips).toEqual([
      { text: "4 TRADES", tone: "muted" },
      { text: "GREEN YEAR", tone: "profit" },
    ]);
    const all = [c.hero.value, ...c.stats.map((s) => s.value)].join(" ");
    expect(all).not.toMatch(/\$/);
    expect(c.stats.map((s) => s.label)).toEqual(["Profit factor", "Green days", "Best streak"]);
  });

  it("shows net P&L as hero when amounts are opted in, keeping win rate as a stat", () => {
    const c = card(true);
    expect(c.hero.label).toBe("Net P&L");
    expect(c.hero.value).toBe("+$200.00");
    expect(c.stats.some((s) => s.label === "Win rate" && s.value === "50%")).toBe(true);
    expect(c.stats.some((s) => s.label === "Best day" && s.value === "+$250.00")).toBe(true);
  });

  it("converts amounts with the fx rate and marks in-progress years", () => {
    const c = card(true, { fxRate: 2, inProgress: true });
    expect(c.hero.value).toBe("+$400.00");
    expect(c.dateLabel).toBe("Year to date");
    expect(card().dateLabel).toBe("Full year");
  });

  it("labels a losing year red", () => {
    const redWrapped = computeYearWrapped(
      [yearTrade({ id: "1", closed_at: "2025-02-05T12:00:00Z", net_pnl: -75 })],
      2025,
    );
    const c = buildWrappedShareCard(redWrapped, {
      showAmounts: false,
      locale: "en-US",
      currency: "USD",
      fxRate: 1,
    });
    expect(c.tone).toBe("loss");
    expect(c.chips[1]).toEqual({ text: "RED YEAR", tone: "loss" });
  });
});
