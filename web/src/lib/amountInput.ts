import BigNumber from "bignumber.js";

export type AmountInputOptions = {
  /** Allow a leading minus sign. Default false. */
  allowNegative?: boolean;
};

/** Strip invalid characters while the user types; keeps partial decimals like `12.` */
export function sanitizeAmountInput(raw: string, opts: AmountInputOptions = {}): string {
  const allowNegative = opts.allowNegative ?? false;
  let s = raw
    .replace(/[$\s]/g, "")
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "");

  if (!allowNegative) {
    s = s.replace(/-/g, "");
  } else {
    const negative = s.startsWith("-");
    s = s.replace(/-/g, "");
    if (negative) s = `-${s}`;
  }

  const dot = s.indexOf(".");
  if (dot >= 0) {
    const head = s.slice(0, dot + 1);
    const tail = s.slice(dot + 1).replace(/\./g, "");
    s = head + tail;
  }

  return s;
}

/** Canonical string for storage / submit; empty when invalid or blank. */
export function normalizeAmountInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "-" || trimmed === "." || trimmed === "-.") return "";

  try {
    const bn = new BigNumber(trimmed);
    if (!bn.isFinite()) return "";
    return bn.toFixed();
  } catch {
    return "";
  }
}

export function parseAmount(raw: string): BigNumber | null {
  const normalized = normalizeAmountInput(raw);
  if (!normalized) return null;
  try {
    const bn = new BigNumber(normalized);
    return bn.isFinite() ? bn : null;
  } catch {
    return null;
  }
}

/** Parse to JS number for APIs that expect `number` (null when empty/invalid). */
export function parseAmountToNumber(raw: string): number | null {
  const bn = parseAmount(raw);
  if (!bn) return null;
  return bn.toNumber();
}
