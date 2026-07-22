import { describe, expect, it } from "vite-plus/test";
import type { Execution, TradeDetail } from "./api/types";
import { flattenSymbolTradesToExecutions, symbolTradeFromDetail } from "./newTradeBlocks";

const fillBuy: Execution = {
  id: "f1",
  user_id: "u1",
  account_id: "a1",
  external_id: null,
  symbol: "TSLA",
  instrument_type: "option",
  side: "buy",
  quantity: 2,
  price: 6.04,
  fees: 0.86,
  commission: 0,
  executed_at: "2026-07-20T14:05:40Z",
  multiplier: 100,
  details: { option_right: "call", strike: "360", expiry: "2026-07-24" },
  import_batch_id: null,
  dedup_hash: "h1",
  created_at: "2026-07-20T14:05:41Z",
};

const fillSell: Execution = {
  ...fillBuy,
  id: "f2",
  side: "sell",
  quantity: 2,
  price: 6.35,
  fees: 0.57,
  executed_at: "2026-07-20T14:11:42Z",
  dedup_hash: "h2",
  created_at: "2026-07-20T14:11:43Z",
};

const trade: TradeDetail = {
  id: "t1",
  account_id: "a1",
  symbol: "TSLA",
  instrument_type: "option",
  direction: "long",
  status: "closed",
  opened_at: fillBuy.executed_at,
  closed_at: fillSell.executed_at,
  qty_opened: 2,
  qty_remaining: 0,
  avg_entry_price: 6.04,
  avg_exit_price: 6.35,
  gross_pnl: 62,
  fees_total: 1.43,
  net_pnl: 60.57,
  pnl_currency: "USD",
  return_pct: null,
  time_in_trade_secs: 362,
  notes: "## Session\nNew York AM\n## Review notes\nclean exit",
  tags: [],
  fills: [fillBuy, fillSell],
  setup: null,
  setup_ids: [],
  initial_risk: null,
  target_price: 7,
  stop_price: 5,
  r_multiple: null,
  emotional_state: "Focused",
  confidence: 4,
  trade_quality: 5,
  mae: null,
  mfe: null,
  dividend_total: 0,
  total_pnl: 60.57,
  attachments: [],
};

describe("symbolTradeFromDetail", () => {
  it("maps fills, option contract, and journal into a symbol block", () => {
    const block = symbolTradeFromDetail(trade);
    expect(block.symbol).toBe("TSLA");
    expect(block.market).toBe("option");
    expect(block.option_right).toBe("call");
    expect(block.option_strike).toBe("360");
    expect(block.side).toBe("long");
    expect(block.session).toBe("New York AM");
    expect(block.reviewNotes).toBe("clean exit");
    expect(block.setupGrade).toBe("A");
    expect(block.rows).toHaveLength(2);
    expect(block.rows[0]?.id).toBe("f1");
    expect(block.rows[1]?.id).toBe("f2");
  });

  it("preserves fill ids when flattening for edit sync", () => {
    const block = symbolTradeFromDetail(trade);
    const flat = flattenSymbolTradesToExecutions([block]);
    expect(flat.map((r) => r.id)).toEqual(["f1", "f2"]);
  });
});
