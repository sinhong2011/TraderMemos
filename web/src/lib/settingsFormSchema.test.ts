import { describe, expect, it } from "vite-plus/test";
import {
  defaultAccountFormValues,
  parseChecklistText,
  parseOptionalAmount,
  riskFormToBody,
  validatePositiveAmount,
  validateRequiredName,
  validateRiskForm,
  validateRiskPercent,
  validateStartingBalance,
} from "./settingsFormSchema";

describe("settingsFormSchema", () => {
  it("requires a name", () => {
    expect(validateRequiredName("")).toMatch(/required/i);
    expect(validateRequiredName("  ")).toMatch(/required/i);
    expect(validateRequiredName("Main")).toBeUndefined();
  });

  it("validates starting balance", () => {
    expect(validateStartingBalance("")).toMatch(/number/i);
    expect(validateStartingBalance("abc")).toMatch(/number/i);
    expect(validateStartingBalance("1000.5")).toBeUndefined();
  });

  it("validates positive cash amounts", () => {
    expect(validatePositiveAmount("0")).toMatch(/positive/i);
    expect(validatePositiveAmount("-1")).toMatch(/positive/i);
    expect(validatePositiveAmount("50")).toBeUndefined();
  });

  it("parses optional amounts", () => {
    expect(parseOptionalAmount("")).toBeNull();
    expect(parseOptionalAmount("  ")).toBeNull();
    expect(parseOptionalAmount("12.5")).toBe(12.5);
  });

  it("validates risk percent bounds", () => {
    expect(validateRiskPercent("")).toBeUndefined();
    expect(validateRiskPercent("101")).toMatch(/0 and 100/);
    expect(validateRiskPercent("1.5")).toBeUndefined();
  });

  it("maps risk form to API body", () => {
    expect(
      riskFormToBody({
        maxRisk: "100",
        maxDaily: "",
        maxOpen: "abc",
        riskPct: "2",
      }),
    ).toEqual({
      max_risk_per_trade: 100,
      max_daily_loss: null,
      max_open_risk: null,
      default_account_risk_pct: 2,
    });
  });

  it("rejects invalid risk form fields", () => {
    expect(
      validateRiskForm({
        maxRisk: "nope",
        maxDaily: "",
        maxOpen: "",
        riskPct: "",
      }),
    ).toMatch(/valid number/i);
  });

  it("parses checklist lines", () => {
    expect(parseChecklistText("  a\n\nb  \n")).toEqual(["a", "b"]);
  });

  it("provides account defaults", () => {
    expect(defaultAccountFormValues().baseCurrency).toBe("USD");
  });
});
