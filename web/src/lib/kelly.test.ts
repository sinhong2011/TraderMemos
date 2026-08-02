import { describe, expect, it } from "vite-plus/test";
import { kellyFraction } from "./kelly";

describe("kellyFraction", () => {
  it("computes the full-Kelly fraction", () => {
    // W=2/3, R=2.5 → 2/3 - (1/3)/2.5 = 0.5333
    expect(kellyFraction(2 / 3, 2.5)).toBeCloseTo(0.5333, 4);
    // Coin flip at 1:1 has zero edge.
    expect(kellyFraction(0.5, 1)).toBeCloseTo(0, 10);
  });

  it("goes negative when there is no edge", () => {
    expect(kellyFraction(0.4, 1)).toBeCloseTo(-0.2, 10);
  });

  it("rejects out-of-range inputs", () => {
    expect(kellyFraction(1.2, 2)).toBeNull();
    expect(kellyFraction(-0.1, 2)).toBeNull();
    expect(kellyFraction(0.5, 0)).toBeNull();
    expect(kellyFraction(Number.NaN, 2)).toBeNull();
    expect(kellyFraction(0.5, Number.NaN)).toBeNull();
  });
});
