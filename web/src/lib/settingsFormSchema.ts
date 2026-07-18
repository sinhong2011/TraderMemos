import { parseAmountToNumber } from "./amountInput";
import type { RiskRules } from "./api/settings";

export function numOrEmpty(v: number | null | undefined): string {
  return v == null ? "" : String(v);
}

/** Optional amount: blank → null; non-blank must parse. */
export function parseOptionalAmount(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  return parseAmountToNumber(t);
}

export function validateRequiredName(value: string, label = "Name"): string | undefined {
  if (!value.trim()) return `${label} is required.`;
  return undefined;
}

export function validateStartingBalance(value: string): string | undefined {
  const n = parseAmountToNumber(value);
  if (n == null) return "Starting balance must be a number.";
  return undefined;
}

export function validatePositiveAmount(value: string): string | undefined {
  const n = parseAmountToNumber(value);
  if (n == null || n <= 0) return "Amount must be a positive number.";
  return undefined;
}

export function validateOptionalAmountField(value: string): string | undefined {
  const t = value.trim();
  if (!t) return undefined;
  if (parseAmountToNumber(t) == null) return "Enter a valid number, or leave blank.";
  return undefined;
}

export function validateRiskPercent(value: string): string | undefined {
  const t = value.trim();
  if (!t) return undefined;
  const n = parseAmountToNumber(t);
  if (n == null) return "Enter a valid number, or leave blank.";
  if (n < 0 || n > 100) return "Default risk % must be between 0 and 100.";
  return undefined;
}

export function validateAccountId(value: string): string | undefined {
  if (!value) return "Account is required.";
  return undefined;
}

export type AccountFormValues = {
  name: string;
  broker: string;
  accountType: string;
  baseCurrency: string;
  startingBalance: string;
};

export function defaultAccountFormValues(): AccountFormValues {
  return {
    name: "",
    broker: "",
    accountType: "cash",
    baseCurrency: "USD",
    startingBalance: "",
  };
}

export type CashFormValues = {
  accountId: string;
  type: string;
  amount: string;
  occurredAt: string;
  note: string;
};

export function defaultCashFormValues(accountId = ""): CashFormValues {
  return {
    accountId,
    type: "deposit",
    amount: "",
    occurredAt: new Date().toISOString().slice(0, 10),
    note: "",
  };
}

export type RiskFormValues = {
  maxRisk: string;
  maxDaily: string;
  maxOpen: string;
  riskPct: string;
};

export function defaultRiskFormValues(rules?: RiskRules | null): RiskFormValues {
  return {
    maxRisk: numOrEmpty(rules?.max_risk_per_trade),
    maxDaily: numOrEmpty(rules?.max_daily_loss),
    maxOpen: numOrEmpty(rules?.max_open_risk),
    riskPct: numOrEmpty(rules?.default_account_risk_pct),
  };
}

export function riskFormToBody(value: RiskFormValues): RiskRules {
  return {
    max_risk_per_trade: parseOptionalAmount(value.maxRisk),
    max_daily_loss: parseOptionalAmount(value.maxDaily),
    max_open_risk: parseOptionalAmount(value.maxOpen),
    default_account_risk_pct: parseOptionalAmount(value.riskPct),
  };
}

export function validateRiskForm(value: RiskFormValues): string | undefined {
  return (
    validateOptionalAmountField(value.maxRisk) ||
    validateOptionalAmountField(value.maxDaily) ||
    validateOptionalAmountField(value.maxOpen) ||
    validateRiskPercent(value.riskPct)
  );
}

export type TagFormValues = {
  name: string;
  color: string;
  kind: string;
};

export function defaultTagFormValues(): TagFormValues {
  return { name: "", color: "#6366f1", kind: "custom" };
}

export type SetupFormValues = {
  name: string;
  description: string;
};

export function defaultSetupFormValues(): SetupFormValues {
  return { name: "", description: "" };
}

export function parseChecklistText(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}
