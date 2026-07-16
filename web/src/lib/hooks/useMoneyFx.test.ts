import { describe, expect, it } from "vite-plus/test";
import { convertAmount } from "./useMoneyFx";

describe("convertAmount", () => {
  it("multiplies by FX rate", () => {
    expect(convertAmount(100, 7.8)).toBeCloseTo(780);
    expect(convertAmount(-50, 7.8)).toBeCloseTo(-390);
  });
});
