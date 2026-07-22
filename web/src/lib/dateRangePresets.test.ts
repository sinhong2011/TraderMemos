import { describe, expect, it } from "vite-plus/test";
import { computePresetRange, presetFromRange } from "./dateRangePresets";

describe("dateRangePresets", () => {
  it("round-trips the 30d preset in UTC+8 evening", () => {
    const now = new Date("2026-07-11T01:00:00+08:00");
    const range = computePresetRange("30d", now);
    expect(presetFromRange(range.from, range.to, now)).toBe("30d");
  });

  it("does not mis-detect 30d as custom due to time-of-day rounding", () => {
    const now = new Date("2026-07-10T17:00:00.000Z");
    const range = computePresetRange("30d", now);
    expect(presetFromRange(range.from, range.to, now)).toBe("30d");
  });
});
