import { describe, expect, it } from "vite-plus/test";
import {
  CUSTOM_PRESET_ID,
  FUTURES_PRESETS,
  multiplierForPreset,
  presetIdForSymbol,
} from "./futuresPresets";

describe("futuresPresets", () => {
  it("resolves NQ multiplier", () => {
    expect(multiplierForPreset("nq")).toBe(20);
    expect(FUTURES_PRESETS.find((p) => p.id === "nq")?.label).toContain("$20");
  });

  it("falls back to 1 for custom", () => {
    expect(multiplierForPreset(CUSTOM_PRESET_ID)).toBe(1);
    expect(multiplierForPreset("unknown")).toBe(1);
  });

  it("matches symbol root", () => {
    expect(presetIdForSymbol("nq")).toBe("nq");
    expect(presetIdForSymbol("ES")).toBe("es");
    expect(presetIdForSymbol("AAPL")).toBe(CUSTOM_PRESET_ID);
  });
});
