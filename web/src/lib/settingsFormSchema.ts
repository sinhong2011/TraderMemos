import { isoToWallClock } from "./displayPrefs";
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
    occurredAt: isoToWallClock(new Date()).slice(0, 10),
    note: "",
  };
}

export type RiskFormValues = {
  maxRisk: string;
  maxDaily: string;
  maxOpen: string;
  riskPct: string;
};

export type RiskRuleKey = keyof RiskRules;

export type RiskRuleDef = {
  key: RiskRuleKey;
  label: string;
  detail: string;
  unit: "$" | "%" | "count";
  placeholder: string;
};

/** Fixed catalog of risk limits supported by the API / compliance check. */
export const RISK_RULE_DEFS: readonly RiskRuleDef[] = [
  {
    key: "max_risk_per_trade",
    label: "Max risk / trade",
    detail: "Cap planned risk on a single trade.",
    unit: "$",
    placeholder: "e.g. 100",
  },
  {
    key: "max_daily_loss",
    label: "Max daily loss",
    detail: "Stop when today's realized loss hits this amount.",
    unit: "$",
    placeholder: "e.g. 300",
  },
  {
    key: "max_open_risk",
    label: "Max open risk",
    detail: "Limit total risk across open positions.",
    unit: "$",
    placeholder: "e.g. 500",
  },
  {
    key: "max_trades_per_day",
    label: "Max trades / day",
    detail: "Cap how many trades close in a single day.",
    unit: "count",
    placeholder: "e.g. 5",
  },
  {
    key: "default_account_risk_pct",
    label: "Default account risk %",
    detail: "Suggested size as a percent of account equity.",
    unit: "%",
    placeholder: "e.g. 1",
  },
] as const;

export function riskRuleDef(key: RiskRuleKey): RiskRuleDef {
  const def = RISK_RULE_DEFS.find((d) => d.key === key);
  if (!def) throw new Error(`Unknown risk rule: ${key}`);
  return def;
}

export function emptyRiskRules(): RiskRules {
  return {
    max_risk_per_trade: null,
    max_daily_loss: null,
    max_open_risk: null,
    default_account_risk_pct: null,
    max_trades_per_day: null,
  };
}

export function activeRiskRuleEntries(
  rules?: RiskRules | null,
): { key: RiskRuleKey; value: number; def: RiskRuleDef }[] {
  const body = rules ?? emptyRiskRules();
  return RISK_RULE_DEFS.flatMap((def) => {
    const value = body[def.key];
    if (value == null) return [];
    return [{ key: def.key, value, def }];
  });
}

export function availableRiskRuleKeys(rules?: RiskRules | null): RiskRuleKey[] {
  const body = rules ?? emptyRiskRules();
  return RISK_RULE_DEFS.filter((def) => body[def.key] == null).map((def) => def.key);
}

export function setRiskRuleValue(
  rules: RiskRules | null | undefined,
  key: RiskRuleKey,
  value: number | null,
): RiskRules {
  return { ...(rules ?? emptyRiskRules()), [key]: value };
}

export function formatRiskRuleValue(key: RiskRuleKey, value: number, locale?: string): string {
  const def = riskRuleDef(key);
  if (def.unit === "%") {
    return `${value.toLocaleString(locale, { maximumFractionDigits: 2 })}%`;
  }
  if (def.unit === "count") {
    return value.toLocaleString(locale, { maximumFractionDigits: 0 });
  }
  return `$${value.toLocaleString(locale, { maximumFractionDigits: 2 })}`;
}

export function validateRiskRuleValue(key: RiskRuleKey, raw: string): string | undefined {
  if (key === "max_trades_per_day") {
    const t = raw.trim();
    if (!t) return "Enter a value.";
    const n = Number(t);
    if (!Number.isInteger(n) || n < 0) return "Enter a whole number of trades.";
    return undefined;
  }
  if (key === "default_account_risk_pct") {
    const t = raw.trim();
    if (!t) return "Enter a value.";
    return validateRiskPercent(raw) ?? undefined;
  }
  const t = raw.trim();
  if (!t) return "Enter a value.";
  return validateOptionalAmountField(raw) ?? undefined;
}

export function parseRiskRuleValue(key: RiskRuleKey, raw: string): number | null {
  if (key === "default_account_risk_pct") {
    const err = validateRiskPercent(raw);
    if (err || !raw.trim()) return null;
    return parseOptionalAmount(raw);
  }
  return parseOptionalAmount(raw);
}

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
    max_trades_per_day: null,
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
