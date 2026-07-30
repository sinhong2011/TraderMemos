import { describe, expect, it } from "vite-plus/test";
import { currencyRegion, currencySymbol } from "./currency";

describe("currencySymbol", () => {
  it("keeps the dollar family distinguishable", () => {
    expect(currencySymbol("USD")).toBe("$");
    expect(currencySymbol("HKD")).toBe("HK$");
    expect(currencySymbol("TWD")).toBe("NT$");
    expect(currencySymbol("AUD")).toBe("A$");
    expect(currencySymbol("SGD")).toBe("S$");
  });

  it("keeps the yen pair distinguishable", () => {
    expect(currencySymbol("CNY")).toBe("CN¥");
    expect(currencySymbol("JPY")).toBe("¥");
  });

  it("normalizes casing and whitespace", () => {
    expect(currencySymbol(" hkd ")).toBe("HK$");
  });

  it("falls back to the Intl symbol for currencies outside the switch", () => {
    expect(currencySymbol("CAD")).toBe("CA$");
  });

  it("returns an empty symbol for an invalid code", () => {
    expect(currencySymbol("NOPE")).toBe("");
  });
});

describe("currencyRegion", () => {
  it("labels offered currencies with their issuing region", () => {
    expect(currencyRegion("HKD")).toBe("Hong Kong");
    expect(currencyRegion("eur")).toBe("Euro area");
  });

  it("has no region for currencies outside the switch", () => {
    expect(currencyRegion("CAD")).toBeUndefined();
  });
});
