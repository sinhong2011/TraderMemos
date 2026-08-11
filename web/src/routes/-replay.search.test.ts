import { describe, expect, it } from "vite-plus/test";
import { validateReplaySearch } from "./replay";

describe("validateReplaySearch", () => {
  it("uppercases the symbol and passes through a valid setup", () => {
    expect(
      validateReplaySearch({ symbol: "aapl", iv: "15", from: "2026-01-05", to: "2026-01-09" }),
    ).toEqual({ symbol: "AAPL", iv: "15", from: "2026-01-05", to: "2026-01-09" });
  });

  it("drops invalid symbols, dates, and intervals", () => {
    expect(validateReplaySearch({ symbol: "not a symbol!!", iv: "2", from: "jan 5" })).toEqual({
      iv: "D",
    });
    expect(validateReplaySearch({})).toEqual({ iv: "D" });
  });

  it("keeps a partial setup", () => {
    expect(validateReplaySearch({ symbol: "ES.F", from: "2026-03-02" })).toEqual({
      symbol: "ES.F",
      iv: "D",
      from: "2026-03-02",
    });
  });
});
