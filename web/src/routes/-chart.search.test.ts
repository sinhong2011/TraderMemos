import { describe, expect, it } from "vite-plus/test";
import { validateChartSearch } from "./chart";

describe("validateChartSearch", () => {
  it("uppercases and passes through a valid symbol", () => {
    expect(validateChartSearch({ symbol: "aapl", iv: "15" })).toEqual({
      symbol: "AAPL",
      iv: "15",
    });
  });

  it("drops invalid symbols and defaults the interval to daily", () => {
    expect(validateChartSearch({ symbol: "not a symbol!!", iv: "2" })).toEqual({ iv: "D" });
    expect(validateChartSearch({})).toEqual({ iv: "D" });
  });

  it("keeps futures-style symbols with dots and dashes", () => {
    expect(validateChartSearch({ symbol: "brk.b", iv: "D" })).toEqual({
      symbol: "BRK.B",
      iv: "D",
    });
  });
});
