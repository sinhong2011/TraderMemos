import type { Execution } from "./api/types";

/** Option contract fields stored in execution.details JSON. */
export type OptionContract = {
  option_right?: "call" | "put";
  strike?: string;
  expiry?: string;
};

/**
 * Normalize execution.details from API (map) or legacy sql.NullString leak
 * (`{String, Valid}`) into a plain string map.
 */
export function parseExecutionDetails(
  details: Execution["details"] | null | undefined,
): Record<string, string> {
  if (details == null) return {};
  if (typeof details === "string") {
    try {
      const parsed = JSON.parse(details) as unknown;
      return isStringRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  if (typeof details === "object" && "String" in details && "Valid" in details) {
    const ns = details as { String?: string; Valid?: boolean };
    if (!ns.Valid || !ns.String) return {};
    try {
      const parsed = JSON.parse(ns.String) as unknown;
      return isStringRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return isStringRecord(details) ? details : {};
}

function isStringRecord(v: unknown): v is Record<string, string> {
  if (v == null || typeof v !== "object" || Array.isArray(v)) return false;
  return Object.values(v).every((x) => typeof x === "string");
}

export function optionContractFromDetails(details: Record<string, string>): OptionContract | null {
  const rightRaw = details.option_right?.trim().toLowerCase();
  const option_right = rightRaw === "call" || rightRaw === "put" ? rightRaw : undefined;
  const strike = details.strike?.trim() || undefined;
  const expiry = details.expiry?.trim() || undefined;
  if (!option_right && !strike && !expiry) return null;
  return { option_right, strike, expiry };
}

/** Prefer the first fill that carries contract fields. */
export function optionContractFromFills(
  fills: readonly Pick<Execution, "details">[],
): OptionContract | null {
  for (const fill of fills) {
    const c = optionContractFromDetails(parseExecutionDetails(fill.details));
    if (c) return c;
  }
  return null;
}

/** e.g. `360 PUT · 2026-07-24` — matches New Trade / OCR contract labels. */
export function formatOptionContractLabel(c: OptionContract | null | undefined): string {
  if (!c) return "";
  const right = c.option_right ? c.option_right.toUpperCase() : "";
  const strikeRight = c.strike && right ? `${c.strike} ${right}` : c.strike || right || "";
  return [strikeRight, c.expiry].filter(Boolean).join(" · ");
}

/** Header market chip for options: `OPT · 360 PUT · 2026-07-24`. */
export function formatOptionMarketChip(
  instrumentType: string,
  marketFallback: string,
  contract: OptionContract | null,
): string {
  if (instrumentType !== "option") return marketFallback;
  const label = formatOptionContractLabel(contract);
  return label ? `OPT · ${label}` : marketFallback;
}
