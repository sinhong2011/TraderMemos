import { describe, expect, it, vi } from "vite-plus/test";
import { journalTradePreviewColumns } from "./importPreviewColumns";
import type { JournalTradePreview } from "@/lib/api/types";

const sampleTrade: JournalTradePreview = {
  row: 2,
  symbol: "TSLA 240119C00200000",
  market: "OPTION",
  instrument_type: "option",
  option_right: "call",
  side: "LONG",
  status: "WIN",
  qty: 1,
  entry: 2.5,
  exit: 3.1,
  return_usd: 60,
  return_pct: 24,
  open_date: "2026-07-10T15:19:46.000Z",
  close_date: "2026-07-10T15:31:16.000Z",
  setup: "Breakout",
  notes: "Scaled out early",
};

describe("journalTradePreviewColumns", () => {
  it("includes an Edit action when onEdit is provided", () => {
    const onEdit = vi.fn<(...args: any[]) => any>();
    const columns = journalTradePreviewColumns("USD", onEdit);
    const marketCol = columns.find((c) => c.id === "market");
    expect(
      marketCol &&
        "accessorFn" in marketCol &&
        typeof marketCol.accessorFn === "function" &&
        marketCol.accessorFn(sampleTrade, 0),
    ).toBe("OPTION");

    const dirCol = columns.find((c) => c.id === "direction");
    expect(dirCol).toBeDefined();
    expect(columns.find((c) => c.id === "option_right")).toBeUndefined();
    expect(columns.find((c) => c.id === "side")).toBeUndefined();

    const actionsCol = columns.find((c) => c.id === "actions");
    expect(actionsCol).toBeDefined();
  });

  it("omits the actions column without onEdit", () => {
    const columns = journalTradePreviewColumns("USD");
    expect(columns.find((c) => c.id === "actions")).toBeUndefined();
  });

  it("maps long call to LC for sorting", () => {
    const columns = journalTradePreviewColumns("USD");
    const dirCol = columns.find((c) => c.id === "direction");
    expect(
      dirCol &&
        "accessorFn" in dirCol &&
        typeof dirCol.accessorFn === "function" &&
        dirCol.accessorFn(sampleTrade, 0),
    ).toBe("LC");
  });
});
