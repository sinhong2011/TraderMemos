import { describe, expect, it } from "vite-plus/test";
import {
  defaultOcrSymbol,
  filterOcrExtractBySymbol,
  groupOcrBySymbol,
  mergeTradeExtracts,
  nextOcrSymbol,
  ocrScanToastDescription,
  ocrSymbolsInExtract,
  partitionOcrWarnings,
} from "./ocrSymbolGroups";
import type { TradeExtract } from "./api/ocr";

const multi: TradeExtract = {
  symbol: "AAPL",
  instrument_type: "option",
  side: "long",
  confidence: 0.9,
  raw_text: "…",
  warnings: ["multiple symbols"],
  symbols: ["AAPL", "NVDA"],
  rows: [
    {
      symbol: "NVDA",
      side: "sell",
      quantity: 1,
      price: 2,
      fees: 1,
      commission: 0,
      executed_at: "2026-07-15T22:00:00Z",
    },
    {
      symbol: "AAPL",
      side: "buy",
      quantity: 4,
      price: 0.95,
      fees: 0.82,
      commission: 0,
      executed_at: "2026-07-15T21:42:18Z",
      option_right: "call",
      strike: 325,
      expiry: "2026-07-17",
    },
    {
      symbol: "AAPL",
      side: "sell",
      quantity: 4,
      price: 1.2,
      fees: 1,
      commission: 0,
      executed_at: "2026-07-15T21:50:00Z",
      option_right: "call",
      strike: 325,
      expiry: "2026-07-17",
    },
  ],
};

describe("ocrSymbolGroups", () => {
  it("lists symbols from extract", () => {
    expect(ocrSymbolsInExtract(multi)).toEqual(["AAPL", "NVDA"]);
  });

  it("defaults to majority symbol", () => {
    expect(defaultOcrSymbol(multi)).toBe("AAPL");
  });

  it("filters fills and re-infers side for the chosen symbol", () => {
    const scoped = filterOcrExtractBySymbol(multi, "AAPL");
    expect(scoped.symbol).toBe("AAPL");
    expect(scoped.rows).toHaveLength(2);
    expect(scoped.rows.every((r) => r.symbol === "AAPL")).toBe(true);
    expect(scoped.side).toBe("long");
    expect(scoped.rows[0].side).toBe("buy");
  });

  it("scopes NVDA alone", () => {
    const scoped = filterOcrExtractBySymbol(multi, "NVDA");
    expect(scoped.rows).toHaveLength(1);
    expect(scoped.side).toBe("short");
  });

  it("re-infers stock instrument when scoped symbol has no option fields", () => {
    const mixed: TradeExtract = {
      ...multi,
      instrument_type: "option",
      symbols: ["AAPL", "RAM"],
      rows: [
        ...multi.rows,
        {
          symbol: "RAM",
          side: "buy",
          quantity: 10,
          price: 12,
          fees: 0,
          commission: 0,
          executed_at: "2026-07-15T22:10:00Z",
        },
      ],
    };
    const scoped = filterOcrExtractBySymbol(mixed, "RAM");
    expect(scoped.instrument_type).toBe("stock");
    expect(scoped.rows).toHaveLength(1);
  });

  it("groups fills by symbol with contract and qty summary", () => {
    const groups = groupOcrBySymbol(multi);
    expect(groups.map((g) => g.symbol)).toEqual(["AAPL", "NVDA"]);
    expect(groups[0]).toMatchObject({
      symbol: "AAPL",
      fillCount: 2,
      instrument: "option",
      side: "long",
      buyQty: 4,
      sellQty: 4,
    });
    expect(groups[0].contractLabel).toContain("325");
    expect(groups[1]).toMatchObject({
      symbol: "NVDA",
      fillCount: 1,
      instrument: "stock",
      side: "short",
    });
  });

  it("picks the next unlogged symbol", () => {
    expect(nextOcrSymbol(multi, "AAPL", new Set())).toBe("NVDA");
    expect(nextOcrSymbol(multi, "AAPL", new Set(["NVDA"]))).toBeNull();
    expect(nextOcrSymbol(multi, "NVDA", new Set(["NVDA"]))).toBe("AAPL");
  });

  it("prefers review-critical warnings for scan toast", () => {
    expect(
      ocrScanToastDescription({
        ...multi,
        warnings: [
          "multiple symbols in screenshot (AAPL, NVDA) — each will be logged as its own trade",
          "vision extract — review fills before saving",
        ],
      }),
    ).toMatch(/vision extract/);
    expect(
      ocrScanToastDescription({
        ...multi,
        warnings: ["vision returned no usable fills — try a clearer screenshot or CSV import"],
      }),
    ).toMatch(/no usable fills/);
    expect(ocrScanToastDescription({ ...multi, warnings: [] })).toMatch(/2 symbols ready/);
  });

  it("partitions warnings into headline, highlights, and details", () => {
    expect(
      partitionOcrWarnings([
        "Merged 2 screenshots (13 fills).",
        "vision extract — review fills before saving",
        "[image 1] multiple symbols found",
        "[image 2] missing execution times",
      ]),
    ).toEqual({
      headline: "Merged 2 screenshots (13 fills).",
      highlights: ["vision extract — review fills before saving"],
      details: ["[image 1] multiple symbols found", "[image 2] missing execution times"],
    });
  });
});

describe("mergeTradeExtracts", () => {
  it("returns a single extract unchanged", () => {
    expect(mergeTradeExtracts([multi])).toBe(multi);
  });

  it("combines rows and symbols from multiple screenshots", () => {
    const a: TradeExtract = {
      symbol: "TSLA",
      instrument_type: "option",
      side: "long",
      confidence: 0.9,
      raw_text: "page1",
      warnings: [],
      rows: [
        {
          symbol: "TSLA",
          side: "buy",
          quantity: 3,
          price: 1.95,
          fees: 2.05,
          commission: 0,
          executed_at: "2026-07-16T13:35:19Z",
          option_right: "put",
          strike: 375,
          expiry: "2026-07-20",
        },
      ],
    };
    const b: TradeExtract = {
      symbol: "TSLA",
      instrument_type: "option",
      side: "long",
      confidence: 0.8,
      raw_text: "page2",
      warnings: ["blurry"],
      rows: [
        {
          symbol: "TSLA",
          side: "sell",
          quantity: 2,
          price: 2.45,
          fees: 0.43,
          commission: 0,
          executed_at: "2026-07-16T13:45:10Z",
          option_right: "put",
          strike: 375,
          expiry: "2026-07-20",
        },
      ],
    };
    const merged = mergeTradeExtracts([a, b]);
    expect(merged.rows).toHaveLength(2);
    expect(merged.symbol).toBe("TSLA");
    expect(merged.instrument_type).toBe("option");
    expect(merged.warnings[0]).toMatch(/Merged 2 screenshots/);
    expect(merged.warnings).toContain("[image 2] blurry");
    expect(merged.raw_text).toContain("page1");
    expect(merged.raw_text).toContain("page2");
    expect(merged.confidence).toBeCloseTo(0.85);
  });
});
