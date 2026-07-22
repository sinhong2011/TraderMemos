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

/** Match if the trade has any of the selected tags (OR). */
export function matchesTradeTagFilter(t: Trade, tagIds: string[] | undefined): boolean {
  if (!tagIds?.length) return true;
  const wanted = new Set(tagIds);
  return t.tags.some((tag) => wanted.has(tag.id));
}

export function filterTradesByTags(trades: Trade[], tagIds: string[] | undefined): Trade[] {
  if (!tagIds?.length) return trades;
  return trades.filter((t) => matchesTradeTagFilter(t, tagIds));
}

export type TagFacetOption = { value: string; label: string; count: number };

/** Unique tags from the current trade set, with occurrence counts. */
export function buildTagFacetOptions(trades: Trade[]): TagFacetOption[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const trade of trades) {
    for (const tag of trade.tags) {
      const cur = counts.get(tag.id);
      if (cur) cur.count += 1;
      else counts.set(tag.id, { label: tag.name, count: 1 });
    }
  }
  return [...counts.entries()]
    .map(([value, { label, count }]) => ({ value, label, count }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
}

const MARKET_FACET_LABELS: Record<string, string> = {
  stock: "Stock",
  option: "Option",
  crypto: "Crypto",
  futures: "Futures",
  forex: "Forex",
};

export type MarketFacetOption = TagFacetOption;

/** Match if the trade's instrument type is in the selected markets (OR). */
export function matchesTradeMarketFilter(t: Trade, markets: string[] | undefined): boolean {
  if (!markets?.length) return true;
  return markets.includes(t.instrument_type);
}

export function filterTradesByMarkets(trades: Trade[], markets: string[] | undefined): Trade[] {
  if (!markets?.length) return trades;
  return trades.filter((t) => matchesTradeMarketFilter(t, markets));
}

/** Unique instrument types from the current trade set, with counts. */
export function buildMarketFacetOptions(trades: Trade[]): MarketFacetOption[] {
  const counts = new Map<string, number>();
  for (const trade of trades) {
    counts.set(trade.instrument_type, (counts.get(trade.instrument_type) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({
      value,
      label: MARKET_FACET_LABELS[value] ?? value,
      count,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
}
