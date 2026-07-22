import type { Trade } from "./api/types";
import {
  buildMarketFacetOptions,
  buildTagFacetOptions,
  filterTradesByMarkets,
  filterTradesByStatus,
  filterTradesByTags,
  matchesTradeMarketFilter,
  matchesTradeStatusFilter,
  matchesTradeTagFilter,
  tradeOutcome,
} from "./tradeFilters";

function partialTrade(partial: Partial<Trade> & Pick<Trade, "status" | "net_pnl">): Trade {
  return {
    id: "x",
    account_id: "a",
    symbol: "X",
    instrument_type: "stock",
    direction: "long",
    opened_at: "2026-07-01T00:00:00Z",
    closed_at: null,
    qty_opened: 1,
    qty_remaining: 0,
    avg_entry_price: 1,
    avg_exit_price: null,
    gross_pnl: null,
    fees_total: 0,
    pnl_currency: "USD",
    return_pct: null,
    time_in_trade_secs: null,
    notes: "",
    tags: [],
    ...partial,
  };
}

const closedWin = partialTrade({
  status: "closed",
  net_pnl: 100,
  tags: [{ id: "t1", user_id: "u", name: "Breakout", color: "", description: "", kind: "custom" }],
});

const closedLoss = partialTrade({
  status: "closed",
  net_pnl: -50,
  instrument_type: "option",
  tags: [{ id: "t2", user_id: "u", name: "FOMO", color: "", description: "", kind: "mistake" }],
});

const openTrade = partialTrade({
  status: "open",
  net_pnl: null,
  tags: [
    { id: "t1", user_id: "u", name: "Breakout", color: "", description: "", kind: "custom" },
    { id: "t2", user_id: "u", name: "FOMO", color: "", description: "", kind: "mistake" },
  ],
});

const washTrade = partialTrade({
  status: "closed",
  net_pnl: 0,
  tags: [],
});

describe("tradeFilters", () => {
  it("classifies trade outcomes", () => {
    expect(tradeOutcome(closedWin)).toBe("win");
    expect(tradeOutcome(closedLoss)).toBe("loss");
    expect(tradeOutcome(openTrade)).toBe("open");
    expect(tradeOutcome(washTrade)).toBe("wash");
  });

  it("filters trades by status", () => {
    const trades = [closedWin, closedLoss, openTrade, washTrade];
    expect(filterTradesByStatus(trades, "win")).toEqual([closedWin]);
    expect(filterTradesByStatus(trades, undefined)).toEqual(trades);
  });

  it("matches individual trades", () => {
    expect(matchesTradeStatusFilter(closedWin, "win")).toBe(true);
    expect(matchesTradeStatusFilter(closedWin, "loss")).toBe(false);
  });

  it("filters trades by tags (any match)", () => {
    const trades = [closedWin, closedLoss, openTrade, washTrade];
    expect(filterTradesByTags(trades, ["t1"])).toEqual([closedWin, openTrade]);
    expect(filterTradesByTags(trades, ["t1", "t2"])).toEqual([closedWin, closedLoss, openTrade]);
    expect(filterTradesByTags(trades, undefined)).toEqual(trades);
    expect(matchesTradeTagFilter(washTrade, ["t1"])).toBe(false);
  });

  it("builds tag facet options with counts", () => {
    expect(buildTagFacetOptions([closedWin, closedLoss, openTrade, washTrade])).toEqual([
      { value: "t1", label: "Breakout", count: 2 },
      { value: "t2", label: "FOMO", count: 2 },
    ]);
  });

  it("filters trades by market (any match)", () => {
    const trades = [closedWin, closedLoss, openTrade, washTrade];
    expect(filterTradesByMarkets(trades, ["option"])).toEqual([closedLoss]);
    expect(filterTradesByMarkets(trades, ["stock"])).toEqual([closedWin, openTrade, washTrade]);
    expect(filterTradesByMarkets(trades, undefined)).toEqual(trades);
    expect(matchesTradeMarketFilter(closedLoss, ["stock"])).toBe(false);
  });

  it("builds market facet options with counts", () => {
    expect(buildMarketFacetOptions([closedWin, closedLoss, openTrade, washTrade])).toEqual([
      { value: "option", label: "Option", count: 1 },
      { value: "stock", label: "Stock", count: 3 },
    ]);
  });
});
