import { describe, expect, it } from "vite-plus/test";
import { parseFillFile } from "./fillFile";

describe("parseFillFile CSV", () => {
  it("maps aliased headers onto fills", () => {
    const csv = [
      "Symbol,Action,Qty,Fill Price,Fee,Comm,Exec Time",
      "aapl,Buy,100,187.25,0.35,1.00,2026-07-30 09:31:02",
      "AAPL,Sell,100,189.10,0.35,1.00,2026-07-30 10:14:45",
    ].join("\n");
    const extract = parseFillFile("fills.csv", csv);
    expect(extract.rows).toHaveLength(2);
    expect(extract.rows[0]).toMatchObject({
      symbol: "AAPL",
      side: "buy",
      quantity: 100,
      price: 187.25,
      fees: 0.35,
      commission: 1,
      executed_at: "2026-07-30 09:31:02",
    });
    expect(extract.rows[1]?.side).toBe("sell");
    expect(extract.confidence).toBe(1);
    expect(extract.warnings).toHaveLength(0);
  });

  it("handles quoted cells, $ and thousands separators, and signed quantities", () => {
    const csv = ["symbol,quantity,price", '"BRK.B",-50,"$1,234.50"'].join("\n");
    const extract = parseFillFile("fills.csv", csv);
    expect(extract.rows[0]).toMatchObject({
      symbol: "BRK.B",
      side: "sell",
      quantity: 50,
      price: 1234.5,
    });
  });

  it("parses option columns", () => {
    const csv = [
      "symbol,side,qty,price,putcall,strike,expiration",
      "SPY,sell to open,2,1.25,P,540,2026-08-15",
    ].join("\n");
    const row = parseFillFile("fills.csv", csv).rows[0];
    expect(row).toMatchObject({
      side: "sell",
      option_right: "put",
      strike: 540,
      expiry: "2026-08-15",
    });
  });

  it("warns about skipped rows without quantity/price", () => {
    const csv = ["qty,price", "10,5", "0,5", ",bad"].join("\n");
    const extract = parseFillFile("fills.csv", csv);
    expect(extract.rows).toHaveLength(1);
    expect(extract.warnings[0]).toMatch(/Skipped 2 rows/);
  });

  it("rejects headers without quantity/price columns", () => {
    expect(() => parseFillFile("fills.csv", "symbol,side\nAAPL,buy")).toThrow(/quantity and price/);
  });

  it("rejects a lone header row", () => {
    expect(() => parseFillFile("fills.csv", "qty,price")).toThrow(/header row/);
  });
});

describe("parseFillFile JSON", () => {
  it("accepts a bare array", () => {
    const json = JSON.stringify([
      { symbol: "NVDA", side: "buy", quantity: 10, price: 120.5, executedAt: "2026-07-30T09:31" },
    ]);
    const extract = parseFillFile("fills.json", json);
    expect(extract.rows[0]).toMatchObject({
      symbol: "NVDA",
      side: "buy",
      quantity: 10,
      price: 120.5,
      executed_at: "2026-07-30T09:31",
    });
  });

  it("accepts an object with a fills array", () => {
    const json = JSON.stringify({ fills: [{ qty: 1, price: 2 }] });
    expect(parseFillFile("fills.json", json).rows).toHaveLength(1);
  });

  it("sniffs JSON content regardless of file name", () => {
    const json = JSON.stringify([{ qty: 1, price: 2 }]);
    expect(parseFillFile("fills.txt", json).rows).toHaveLength(1);
  });

  it("rejects invalid JSON and non-array shapes", () => {
    expect(() => parseFillFile("fills.json", "{nope")).toThrow(/valid JSON/);
    expect(() => parseFillFile("fills.json", '{"a":1}')).toThrow(/fills\/rows\/executions/);
  });

  it("rejects files with no usable fills", () => {
    expect(() => parseFillFile("fills.json", '[{"qty":0,"price":0}]')).toThrow(/usable fills/);
  });
});
