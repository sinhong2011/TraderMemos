import { describe, expect, it } from "vite-plus/test";
import type { TradeDetail } from "./api/types";
import { computeTradeInsights, generateTradeCoachNotes } from "./tradeInsights";

function baseTrade(over: Partial<TradeDetail> = {}): TradeDetail {
  return {
    id: "t1",
    account_id: "a1",
    symbol: "AAPL",
    instrument_type: "stock",
    direction: "long",
    status: "closed",
    opened_at: "2026-03-10T09:30:00Z",
    closed_at: "2026-03-10T11:45:00Z",
    qty_opened: 100,
    qty_remaining: 0,
    avg_entry_price: 100,
    avg_exit_price: 110,
    gross_pnl: 1000,
    fees_total: 50,
    net_pnl: 950,
    pnl_currency: "USD",
    return_pct: 9.5,
    time_in_trade_secs: 8100,
    notes: "",
    tags: [],
    fills: [],
    setup: {
      id: "s1",
      user_id: "u1",
      name: "ORB",
      description: "",
      created_at: "",
      thesis: "",
      symbol: "",
      direction: "",
      target_price: null,
      stop_price: null,
      checklist: [],
    },
    setup_ids: ["s1"],
    initial_risk: 200,
    target_price: 120,
    stop_price: 98,
    r_multiple: 4.75,
    emotional_state: "Focused",
    confidence: 4,
    trade_quality: 5,
    mae: 40,
    mfe: 1200,
    post_exit_mae: null,
    post_exit_mfe: null,
    dividend_total: 0,
    total_pnl: 950,
    attachments: [],
    ...over,
  };
}

describe("computeTradeInsights", () => {
  it("computes fee drag and MFE capture", () => {
    const i = computeTradeInsights(baseTrade());
    expect(i.feeDragPct).toBeCloseTo(0.05);
    expect(i.mfeCapturePct).toBeCloseTo(950 / 1200);
    expect(i.leftOnTable).toBeCloseTo(250);
    expect(i.setupName).toBe("ORB");
    expect(i.setupGrade).toBe("A");
    expect(i.executionGrade).toBe("A+");
    expect(i.plannedRR).toBeCloseTo(10); // (120-100)/(100-98)
  });

  it("omits capture when MFE is missing", () => {
    const i = computeTradeInsights(baseTrade({ mfe: null, mae: null }));
    expect(i.mfeCapturePct).toBeNull();
    expect(i.leftOnTable).toBeNull();
  });

  it("passes post-exit excursion through", () => {
    const i = computeTradeInsights(baseTrade({ post_exit_mfe: 320, post_exit_mae: 45 }));
    expect(i.postExitMfe).toBe(320);
    expect(i.postExitMae).toBe(45);
    expect(computeTradeInsights(baseTrade()).postExitMfe).toBeNull();
  });
});

describe("generateTradeCoachNotes", () => {
  it("notes a missed run after the exit in R terms", () => {
    const trade = baseTrade({ post_exit_mfe: 400, post_exit_mae: 30 });
    const notes = generateTradeCoachNotes(trade, computeTradeInsights(trade));
    expect(notes.some((n) => n.headline === "~2.0R more ran after your exit")).toBe(true);
  });

  it("credits a well-timed exit when price dropped after the close", () => {
    const trade = baseTrade({ post_exit_mfe: 50, post_exit_mae: 300 });
    const notes = generateTradeCoachNotes(trade, computeTradeInsights(trade));
    const note = notes.find((n) => n.headline === "Exit dodged ~1.5R of drawdown");
    expect(note?.tone).toBe("pos");
  });

  it("stays quiet on post-exit when the excursion is unremarkable", () => {
    const trade = baseTrade({ post_exit_mfe: 100, post_exit_mae: 120 });
    const notes = generateTradeCoachNotes(trade, computeTradeInsights(trade));
    expect(notes.some((n) => n.id === "exited-early" || n.id === "well-timed-exit")).toBe(false);
  });

  it("flags no plan, overconfidence, and fee drag on a losing scratch trade", () => {
    const trade = baseTrade({
      net_pnl: -171.83,
      gross_pnl: -163,
      return_pct: -24.1,
      fees_total: 8.83,
      initial_risk: null,
      target_price: null,
      stop_price: null,
      r_multiple: null,
      emotional_state: "Overconfident",
      confidence: 3,
      trade_quality: null,
      notes: "",
      tags: [
        {
          id: "m1",
          user_id: "u1",
          name: "No plan",
          color: "#f87171",
          description: "",
          kind: "mistake",
        },
      ],
      fills: [
        { id: "f1", side: "buy", quantity: 4, price: 1.46 } as TradeDetail["fills"][0],
        { id: "f2", side: "buy", quantity: 1, price: 1.29 } as TradeDetail["fills"][0],
        { id: "f3", side: "sell", quantity: 5, price: 1.1 } as TradeDetail["fills"][0],
      ],
      time_in_trade_secs: 960,
    });
    const insights = computeTradeInsights(trade);
    const notes = generateTradeCoachNotes(trade, insights);
    const headlines = notes.map((n) => n.headline);
    expect(headlines.some((h) => /no plan was recorded/i.test(h))).toBe(true);
    expect(headlines.some((h) => /Overconfident/i.test(h))).toBe(true);
    expect(headlines.some((h) => /fees/i.test(h))).toBe(true);
    expect(notes.length).toBeLessThanOrEqual(5);
  });

  it("praises strong R-multiple wins", () => {
    const trade = baseTrade({ net_pnl: 950, r_multiple: 4.75 });
    const insights = computeTradeInsights(trade);
    const notes = generateTradeCoachNotes(trade, insights);
    expect(notes.some((n) => /Strong \+4\.8R/i.test(n.headline))).toBe(true);
  });
});
