import type { Trade } from "./api/types";

export type TradeStatusFilter = "win" | "loss" | "open" | "wash";

export function tradeOutcome(t: Trade): TradeStatusFilter | null {
  if (t.status === "open") return "open";
  if (t.net_pnl == null || t.net_pnl === 0) return "wash";
  if (t.net_pnl > 0) return "win";
  return "loss";
}

export function matchesTradeStatusFilter(t: Trade, filter: TradeStatusFilter | undefined): boolean {
  if (!filter) return true;
  return tradeOutcome(t) === filter;
}

export function filterTradesByStatus(
  trades: Trade[],
  filter: TradeStatusFilter | undefined,
): Trade[] {
  if (!filter) return trades;
  return trades.filter((t) => matchesTradeStatusFilter(t, filter));
}
