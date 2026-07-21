import { describe, expect, it } from "vite-plus/test";
import { validateReportsSearch } from "./reports";

describe("validateReportsSearch", () => {
  it("passes through a valid tab", () => {
    expect(validateReportsSearch({ tab: "detailed" })).toEqual({
      tab: "detailed",
      side: "all",
      dur: "all",
      pnl: "net",
      unit: "abs",
    });
  });

  it("defaults to overview when tab is missing", () => {
    expect(validateReportsSearch({})).toEqual({
      tab: "overview",
      side: "all",
      dur: "all",
      pnl: "net",
      unit: "abs",
    });
  });

  it("coerces an unknown tab to overview", () => {
    expect(validateReportsSearch({ tab: "bogus" })).toEqual({
      tab: "overview",
      side: "all",
      dur: "all",
      pnl: "net",
      unit: "abs",
    });
  });

  it("defaults side and dur to all", () => {
    expect(validateReportsSearch({})).toEqual({
      tab: "overview",
      side: "all",
      dur: "all",
      pnl: "net",
      unit: "abs",
    });
  });

  it("passes through valid side and dur and coerces unknowns", () => {
    expect(validateReportsSearch({ side: "long", dur: "swing" })).toEqual({
      tab: "overview",
      side: "long",
      dur: "swing",
      pnl: "net",
      unit: "abs",
    });
    expect(validateReportsSearch({ side: "bogus", dur: "nope" })).toEqual({
      tab: "overview",
      side: "all",
      dur: "all",
      pnl: "net",
      unit: "abs",
    });
  });

  it("defaults and coerces pnl/unit", () => {
    expect(validateReportsSearch({})).toMatchObject({ pnl: "net", unit: "abs" });
    expect(validateReportsSearch({ pnl: "gross", unit: "pct" })).toMatchObject({
      pnl: "gross",
      unit: "pct",
    });
    expect(validateReportsSearch({ pnl: "x", unit: "y" })).toMatchObject({
      pnl: "net",
      unit: "abs",
    });
  });
});
