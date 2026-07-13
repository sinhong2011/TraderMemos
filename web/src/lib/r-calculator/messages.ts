import type { WarningKey } from "./calc";

const WARNINGS: Record<WarningKey, string> = {
	warn_stop_below_entry_long: "Stop must be below entry for a long",
	warn_stop_above_entry_short: "Stop must be above entry for a short",
	warn_capital_too_small_stock:
		"Capital can't buy 1 share — pick a cheaper instrument or add capital",
	warn_risk_below_setting: "Actual risk is below your target.",
	warn_prem_stop_vs_entry: "Stop premium must be below entry premium",
	warn_capital_too_small_option:
		"Capital can't buy 1 contract — lower the premium or add capital",
	warn_risk_budget_too_small:
		"Risk budget under 1 contract — raise Risk% or tighten the stop",
	warn_tier_sum_over100: "Exit tiers exceed 100% — lower the percentages",
	warn_tier_rnon_positive: "Exit tier R must be greater than 0",
	warn_trailer_stop_too_high: "Trailing stop should sit below the first tier",
	warn_fvg_zone_invalid: "Gap top must sit above the bottom — check the edges",
	warn_fvg_oner_nonpositive:
		"Entry and stop collapse to no risk — move the entry or add a stop buffer",
	warn_fvg_account_too_small:
		"Account is too small to take even one share at this risk",
};

export function msg(key: WarningKey): string {
	return WARNINGS[key];
}

export function limiterLabel(limiter: string): string {
	switch (limiter) {
		case "risk":
			return "Risk-limited";
		case "cash":
			return "Cash-limited";
		default:
			return "—";
	}
}
