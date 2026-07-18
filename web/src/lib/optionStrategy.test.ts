import { describe, expect, it } from "vite-plus/test";
import { detectOptionStrategy, buildExecutionDetails } from "./optionStrategy";

describe("detectOptionStrategy", () => {
  it("detects long call as bullish", () => {
    const s = detectOptionStrategy("long", ["call", "call"]);
    expect(s).toEqual({
      label: "Long Call",
      bias: "bullish",
      biasLabel: "Bullish auto-detected from legs",
    });
  });

  it("detects short put as bullish", () => {
    const s = detectOptionStrategy("short", ["put"]);
    expect(s?.label).toBe("Short Put");
    expect(s?.bias).toBe("bullish");
  });

  it("flags mixed rights", () => {
    const s = detectOptionStrategy("long", ["call", "put"]);
    expect(s?.label).toBe("Multi-leg");
  });
});

describe("buildExecutionDetails", () => {
  it("omits empty payload", () => {
    expect(buildExecutionDetails({})).toBeUndefined();
  });

  it("keeps call/strike/expiry", () => {
    expect(
      buildExecutionDetails({ option_right: "call", strike: "325", expiry: "2026-07-17" }),
    ).toEqual({ option_right: "call", strike: "325", expiry: "2026-07-17" });
  });
});
