import { describe, expect, it } from "vite-plus/test";
import type { JournalTradePreview } from "../lib/api/types";
import {
  effectiveOptionRight,
  formatMarketLabel,
  formatOptionRightLabel,
  formatOptionTypeLabel,
  mergeOptionOverrides,
  needsOptionRight,
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

const stockTrade: JournalTradePreview = {
  ...optionTrade,
  row: 1,
  symbol: "AAPL",
  market: "STOCK",
  instrument_type: "stock",
};

describe("importOptionRight", () => {
  it("keeps market separate from call/put", () => {
    expect(formatMarketLabel(optionTrade)).toBe("OPTION");
    expect(formatMarketLabel(stockTrade)).toBe("STOCK");
    expect(formatOptionRightLabel(optionTrade, {})).toBe("");
    expect(formatOptionRightLabel(optionTrade, { 4: "call" })).toBe("CALL");
    expect(formatOptionRightLabel(stockTrade, {})).toBe("");
  });

  it("uses overrides over preview values", () => {
    expect(effectiveOptionRight(optionTrade, { 4: "put" })).toBe("put");
    expect(formatOptionTypeLabel(optionTrade, {})).toBe("OPT");
    expect(formatOptionTypeLabel(optionTrade, { 4: "call" })).toBe("CALL");
    expect(needsOptionRight(optionTrade, {})).toBe(true);
    expect(needsOptionRight(optionTrade, { 4: "put" })).toBe(false);
  });

  it("merges overrides into preview rows", () => {
    const merged = mergeOptionOverrides([optionTrade], { 4: "call" });
    expect(merged[0]?.option_right).toBe("call");
  });
});
