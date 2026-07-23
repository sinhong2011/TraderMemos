import { describe, expect, it } from "vite-plus/test";
import type { JournalTradePreview } from "./api/types";
import {
  importPreviewEditId,
  isImportPreviewEditId,
  tradeDetailFromJournalPreview,
} from "./importTradePreview";

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

describe("importTradePreview", () => {
  it("builds a TradeDetail snapshot for NewTradeDrawer edit mode", () => {
    const detail = tradeDetailFromJournalPreview(optionTrade, {
      accountId: "a1",
      optionRight: "call",
      currency: "USD",
    });
    expect(detail.id).toBe(importPreviewEditId(4));
    expect(isImportPreviewEditId(detail.id)).toBe(true);
    expect(detail.instrument_type).toBe("option");
    expect(detail.direction).toBe("long");
    expect(detail.fills).toHaveLength(2);
    expect(detail.fills[0]?.side).toBe("buy");
    expect(detail.fills[1]?.side).toBe("sell");
    expect(detail.fills[0]?.details).toEqual({ option_right: "call" });
    expect(detail.fills[0]?.multiplier).toBe(100);
  });
});
