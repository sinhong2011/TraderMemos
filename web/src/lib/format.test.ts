import { describe, expect, it } from "vitest";
import { fmtMoney, fmtPct, fmtSignedMoney } from "./format";

describe("formatters", () => {
  it("formats money by locale + currency", () => {
    expect(fmtMoney(4182, "USD", "en-US")).toBe("$4,182.00");
  });
  it("formats signed money", () => {
    expect(fmtSignedMoney(198, "USD", "en-US")).toBe("+$198.00");
    expect(fmtSignedMoney(-102, "USD", "en-US")).toBe("-$102.00");
  });
  it("formats percent", () => {
    expect(fmtPct(0.58, "en-US")).toBe("58%");
  });
});
