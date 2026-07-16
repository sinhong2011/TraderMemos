import { describe, expect, it } from "vite-plus/test";
import {
  normalizeAmountInput,
  parseAmount,
  parseAmountToNumber,
  sanitizeAmountInput,
} from "./amountInput";

describe("sanitizeAmountInput", () => {
  it("allows partial decimals", () => {
    expect(sanitizeAmountInput("12.")).toBe("12.");
    expect(sanitizeAmountInput("0.")).toBe("0.");
  });

  it("strips invalid characters", () => {
    expect(sanitizeAmountInput("12a3")).toBe("123");
    expect(sanitizeAmountInput("$1,234.50")).toBe("1234.50");
  });

  it("blocks minus unless allowed", () => {
    expect(sanitizeAmountInput("-5")).toBe("5");
    expect(sanitizeAmountInput("-5", { allowNegative: true })).toBe("-5");
  });
});

describe("normalizeAmountInput", () => {
  it("canonicalizes via BigNumber", () => {
    expect(normalizeAmountInput("12.")).toBe("12");
    expect(normalizeAmountInput("001.50")).toBe("1.5");
    expect(normalizeAmountInput("")).toBe("");
    expect(normalizeAmountInput(".")).toBe("");
  });
});

describe("parseAmount", () => {
  it("returns null for empty", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmountToNumber("")).toBeNull();
  });

  it("parses valid amounts", () => {
    expect(parseAmountToNumber("123.45")).toBe(123.45);
    expect(parseAmount("0.1")!.plus("0.2").toNumber()).toBeCloseTo(0.3);
  });
});
