import { describe, expect, it } from "vite-plus/test";
import {
  formatOptionContractLabel,
  formatOptionMarketChip,
  optionContractFromFills,
  optionContractFromTrade,
  parseExecutionDetails,
} from "./optionContract";

describe("parseExecutionDetails", () => {
  it("returns a plain map", () => {
    expect(
      parseExecutionDetails({ option_right: "put", strike: "360", expiry: "2026-07-24" }),
    ).toEqual({
      option_right: "put",
      strike: "360",
      expiry: "2026-07-24",
    });
  });

  it("unwraps legacy sql.NullString JSON", () => {
    expect(
      parseExecutionDetails({
        String: '{"option_right":"put","strike":"360","expiry":"2026-07-24"}',
        Valid: true,
      } as never),
    ).toEqual({ option_right: "put", strike: "360", expiry: "2026-07-24" });
  });
});

describe("optionContractFromFills", () => {
  it("reads contract from the first fill with details", () => {
    expect(
      optionContractFromFills([
        { details: {} },
        { details: { option_right: "put", strike: "360", expiry: "2026-07-24" } },
      ]),
    ).toEqual({ option_right: "put", strike: "360", expiry: "2026-07-24" });
  });
});

describe("formatOptionContractLabel", () => {
  it("formats strike right and expiry", () => {
    expect(
      formatOptionContractLabel({ option_right: "put", strike: "360", expiry: "2026-07-24" }),
    ).toBe("360 PUT · 2026-07-24");
  });
});

describe("optionContractFromTrade", () => {
  it("reads list-row contract fields", () => {
    expect(
      optionContractFromTrade({
        instrument_type: "option",
        option_right: "call",
        option_strike: "22.5",
        option_expiry: "2025-05-30",
      }),
    ).toEqual({ option_right: "call", strike: "22.5", expiry: "2025-05-30" });
    expect(optionContractFromTrade({ instrument_type: "stock", option_right: "call" })).toBeNull();
  });
});

describe("formatOptionMarketChip", () => {
  it("prefixes OPT for options with contract", () => {
    expect(
      formatOptionMarketChip("option", "OPT", {
        option_right: "put",
        strike: "360",
        expiry: "2026-07-24",
      }),
    ).toBe("OPT · 360 PUT · 2026-07-24");
  });

  it("falls back for non-options", () => {
    expect(formatOptionMarketChip("stock", "STK", null)).toBe("STK");
  });
});
