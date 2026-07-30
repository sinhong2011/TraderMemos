import type { JournalTradePreview } from "@/lib/api/types";

export type OptionRightOverride = "call" | "put";

export function effectiveOptionRight(
  trade: JournalTradePreview,
  overrides: Record<number, OptionRightOverride>,
): string {
  return overrides[trade.row] ?? trade.option_right ?? "";
}

export function mergeOptionOverrides(
  trades: JournalTradePreview[],
  overrides: Record<number, OptionRightOverride>,
): JournalTradePreview[] {
  if (Object.keys(overrides).length === 0) return trades;
  return trades.map((trade) => {
    const optionRight = effectiveOptionRight(trade, overrides);
    return optionRight === trade.option_right ? trade : { ...trade, option_right: optionRight };
  });
}

/** Market / instrument class only (STOCK, OPTION, …) — not call/put. */
export function formatMarketLabel(trade: JournalTradePreview): string {
  if (trade.instrument_type === "option") return "OPTION";
  const market = trade.market?.trim();
  if (market) return market.toUpperCase();
  return trade.instrument_type?.toUpperCase() || "—";
}

/** Call/put label when known; empty when unset or non-option. */
export function formatOptionRightLabel(
  trade: JournalTradePreview,
  overrides: Record<number, OptionRightOverride> = {},
): string {
  if (trade.instrument_type !== "option") return "";
  const right = effectiveOptionRight(trade, overrides);
  if (right === "call") return "CALL";
  if (right === "put") return "PUT";
  return "";
}

/** @deprecated Prefer formatMarketLabel + formatOptionRightLabel. */
export function formatOptionTypeLabel(
  trade: JournalTradePreview,
  overrides: Record<number, OptionRightOverride> = {},
): string {
  if (trade.instrument_type !== "option") return formatMarketLabel(trade);
  return formatOptionRightLabel(trade, overrides) || "OPT";
}

export function needsOptionRight(
  trade: JournalTradePreview,
  overrides: Record<number, OptionRightOverride> = {},
): boolean {
  return trade.instrument_type === "option" && !effectiveOptionRight(trade, overrides);
}
