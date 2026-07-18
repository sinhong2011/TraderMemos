import { describe, expect, it } from "vite-plus/test";
import {
  emptyExecutionRow,
  emptySymbolTrade,
  executionRowSchema,
  parseTradeRows,
  validatePositiveAmount,
  validateSymbol,
  validateSymbolTrades,
  validateTradeRows,
} from "./newTradeFormSchema";
import { flattenSymbolTradesToExecutions } from "./newTradeBlocks";

describe("newTradeFormSchema", () => {
  it("rejects empty symbol", () => {
    expect(validateSymbol("")).toMatch(/required/i);
    expect(validateSymbol("  ")).toMatch(/required/i);
  });

  it("rejects invalid qty strings", () => {
    expect(validatePositiveAmount("abc", "qty")).toMatch(/required|>/i);
    expect(validatePositiveAmount("0", "qty")).toMatch(/> 0/);
  });

  it("parses valid execution rows", () => {
    const rows = parseTradeRows([
      {
        side: "buy",
        executed_at: "2024-01-15T10:30:00",
        quantity: "10",
        price: "185.5",
        fees: "0.5",
        commission: "1",
        option_right: "",
        strike: "",
        expiry: "",
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].quantity).toBe(10);
    expect(rows[0].price).toBe(185.5);
  });

  it("rejects rows with letter qty at parse time", () => {
    expect(
      executionRowSchema.safeParse({
        side: "buy",
        executed_at: "2024-01-15T10:30:00",
        quantity: "abc",
        price: "10",
        fees: "",
        commission: "",
        option_right: "",
        strike: "",
        expiry: "",
      }).success,
    ).toBe(false);
  });

  it("requires at least one valid row", () => {
    expect(
      validateTradeRows([
        {
          side: "buy",
          executed_at: "2024-01-15T10:30:00",
          quantity: "",
          price: "",
          fees: "",
          commission: "",
          option_right: "",
          strike: "",
          expiry: "",
        },
      ]),
    ).toMatch(/valid execution row/i);
  });

  it("validates multi-symbol batches", () => {
    expect(validateSymbolTrades([emptySymbolTrade()])).toMatch(/symbol is required/i);
    const aapl = emptySymbolTrade({
      symbol: "AAPL",
      rows: [{ ...emptyExecutionRow("buy"), quantity: "1", price: "10" }],
    });
    const empty = emptySymbolTrade({ symbol: "" });
    expect(validateSymbolTrades([aapl, empty])).toBeUndefined();
  });

  it("flattens multiple symbol blocks for one save", () => {
    const flat = flattenSymbolTradesToExecutions([
      emptySymbolTrade({
        symbol: "AAPL",
        rows: [{ ...emptyExecutionRow("buy"), quantity: "1", price: "10" }],
      }),
      emptySymbolTrade({
        symbol: "TSLA",
        rows: [{ ...emptyExecutionRow("sell"), quantity: "2", price: "200" }],
      }),
    ]);
    expect(flat.map((r) => r.symbol)).toEqual(["AAPL", "TSLA"]);
  });
});
