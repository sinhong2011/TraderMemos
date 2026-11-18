import { describe, expect, it } from "vite-plus/test";
import {
  captureTradesView,
  parseTradesViews,
  resolveTradesView,
  viewMatches,
  type TradesViewState,
} from "./tradeViews";

const base: TradesViewState = { sorting: [], columnVisibility: {} };

describe("captureTradesView", () => {
  it("captures filters, sort and hidden columns", () => {
    const view = captureTradesView({
      name: "  Futures losers  ",
      id: "v1",
      state: {
        ...base,
        from: "2026-01-05",
        to: "2026-01-09",
        symbols: ["NQ", "ES"],
        markets: ["futures"],
        tradeStatus: "loss",
        sorting: [{ id: "net_pnl", desc: false }],
        columnVisibility: { fees_total: false, symbol: true },
      },
    });
    expect(view).toEqual({
      id: "v1",
      name: "Futures losers",
      range: { from: "2026-01-05", to: "2026-01-09" },
      symbols: ["ES", "NQ"],
      markets: ["futures"],
      tradeStatus: "loss",
      sorting: [{ id: "net_pnl", desc: false }],
      hidden: ["fees_total"],
    });
  });

  it("keeps an empty range relative", () => {
    expect(captureTradesView({ name: "All", state: base }).range).toBe("all");
  });
});

describe("resolveTradesView / viewMatches", () => {
  it("round-trips and matches the state it restores", () => {
    const state: TradesViewState = {
      ...base,
      from: "2025-03-01",
      to: "2025-03-31",
      tagIds: ["b", "a"],
      sorting: [{ id: "opened_at", desc: true }],
      columnVisibility: { contract: false },
    };
    const view = captureTradesView({ name: "March", state });
    const restored = resolveTradesView(view);
    expect(restored.tagIds).toEqual(["a", "b"]);
    expect(restored.columnVisibility).toEqual({ contract: false });
    expect(viewMatches(view, restored)).toBe(true);
    expect(viewMatches(view, state)).toBe(true);
  });

  it("stops matching once a filter, sort or column changes", () => {
    const state: TradesViewState = { ...base, symbols: ["AAPL"] };
    const view = captureTradesView({ name: "Apple", state });
    expect(viewMatches(view, { ...state, symbols: ["AAPL", "MSFT"] })).toBe(false);
    expect(viewMatches(view, { ...state, sorting: [{ id: "symbol", desc: false }] })).toBe(false);
    expect(viewMatches(view, { ...state, columnVisibility: { qty_opened: false } })).toBe(false);
    expect(viewMatches(view, { ...state, tradeStatus: "win" })).toBe(false);
  });

  it("treats visible-true columns the same as unset", () => {
    const view = captureTradesView({ name: "Default", state: base });
    expect(viewMatches(view, { ...base, columnVisibility: { symbol: true } })).toBe(true);
  });
});

describe("parseTradesViews", () => {
  it("drops malformed entries and duplicates, sanitizes fields", () => {
    const out = parseTradesViews([
      { id: "a", name: "Good", range: "30d", tradeStatus: "nope", sorting: [{ id: "x" }, 4] },
      { id: "a", name: "Dupe", range: "7d" },
      { id: "", name: "No id" },
      { id: "b", name: "   " },
      { id: "c", name: "Bad range", range: "forever", symbols: ["ES", 1, ""] },
      "junk",
    ]);
    expect(out).toEqual([
      { id: "a", name: "Good", range: "30d", sorting: [{ id: "x", desc: false }] },
      { id: "c", name: "Bad range", range: "all", symbols: ["ES"] },
    ]);
  });

  it("returns [] for anything that isn't a list", () => {
    expect(parseTradesViews(undefined)).toEqual([]);
    expect(parseTradesViews({ id: "a" })).toEqual([]);
  });
});
