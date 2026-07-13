import { describe, expect, it } from "vitest";
import type { JournalTradePreview } from "../lib/api/types";
import {
	effectiveOptionRight,
	formatOptionTypeLabel,
	mergeOptionOverrides,
} from "./importOptionRight";

const optionTrade: JournalTradePreview = {
	row: 4,
	symbol: "NVDA",
	market: "OPTION",
	instrument_type: "option",
	side: "LONG",
	qty: 3,
	entry: 2.3,
	exit: 2.43,
	return_usd: 36.84,
	open_date: "2026-07-10T15:19:46.000Z",
	close_date: "2026-07-10T15:31:16.000Z",
};

describe("importOptionRight", () => {
	it("uses overrides over preview values", () => {
		expect(effectiveOptionRight(optionTrade, { 4: "put" })).toBe("put");
		expect(formatOptionTypeLabel(optionTrade, {})).toBe("Set type");
		expect(formatOptionTypeLabel(optionTrade, { 4: "call" })).toBe("CALL");
	});

	it("merges overrides into preview rows", () => {
		const merged = mergeOptionOverrides([optionTrade], { 4: "call" });
		expect(merged[0]?.option_right).toBe("call");
	});
});
