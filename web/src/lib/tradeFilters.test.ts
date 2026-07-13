import { describe, expect, it } from "vite-plus/test";
import type { Trade } from "./api/types";
import { filterTradesByStatus, matchesTradeStatusFilter, tradeOutcome } from "./tradeFilters";

const closedWin = {
  status: "closed",
  net_pnl: 100,
} as Trade;

const closedLoss = {
  status: "closed",
  net_pnl: -50,
} as Trade;

const openTrade = {
  status: "open",
  net_pnl: null,
} as Trade;

const washTrade = {
  status: "closed",
  net_pnl: 0,
} as Trade;

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
});
