import { describe, expect, it } from "vite-plus/test";
import type { TradeDetail } from "./api/types";
import { computeRiskReward } from "./riskReward";

const baseTrade: TradeDetail = {
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
  fees_total: 10,
  net_pnl: 990,
  pnl_currency: "USD",
  return_pct: 10,
  time_in_trade_secs: 3600,
  notes: "",
  tags: [],
  fills: [
    {
      id: "f1",
      user_id: "u1",
      account_id: "a1",
      external_id: null,
      symbol: "AAPL",
      instrument_type: "stock",
      side: "buy",
      quantity: 100,
      price: 100,
      fees: 5,
      commission: 5,
      executed_at: "2026-03-10T09:30:00Z",
      multiplier: 1,
      details: null,
      import_batch_id: null,
      dedup_hash: "x",
      created_at: "2026-03-10T09:30:00Z",
    },
  ],
  setup: null,
  initial_risk: 200,
  target_price: 110,
  stop_price: 95,
  r_multiple: 4.95,
  emotional_state: "",
  confidence: null,
  trade_quality: null,
  mae: null,
  mfe: null,
  post_exit_mae: null,
  post_exit_mfe: null,
  dividend_total: 0,
  total_pnl: 990,
  attachments: [],
};

describe("computeRiskReward", () => {
  it("computes planned R:R and max profit/loss for a long trade", () => {
    const m = computeRiskReward(baseTrade);
    expect(m.maxProfit).toBe(1000);
    expect(m.maxLoss).toBe(-500);
    expect(m.plannedRR).toBeCloseTo(2, 5);
    expect(m.breakeven).toBeCloseTo(100.1, 5);
    expect(m.holdLabel).toBe("1h");
  });

  it("labels sub-minute holds as <1m", () => {
    expect(computeRiskReward({ ...baseTrade, time_in_trade_secs: 0 }).holdLabel).toBe("<1m");
    expect(computeRiskReward({ ...baseTrade, time_in_trade_secs: 45 }).holdLabel).toBe("<1m");
  });
});
