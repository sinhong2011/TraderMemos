import type { JournalTradePreview } from "../lib/api/types";

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
		return optionRight === trade.option_right
			? trade
			: { ...trade, option_right: optionRight };
	});
}

export function formatOptionTypeLabel(
	trade: JournalTradePreview,
	overrides: Record<number, OptionRightOverride> = {},
): string {
	if (trade.instrument_type !== "option") {
		return trade.market || trade.instrument_type?.toUpperCase() || "—";
	}
	const right = effectiveOptionRight(trade, overrides);
	if (right === "call") return "CALL";
	if (right === "put") return "PUT";
	return "Set type";
}
