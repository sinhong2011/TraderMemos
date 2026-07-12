/** Number formatting — every displayed figure is rounded per the spec. */

/** Round to 2 decimals (avoids float dust like 100.30000000000001). */
export function round2(x: number): number {
  return Math.round((Number.isFinite(x) ? x : 0) * 100) / 100;
}

/** Price / amount with exactly 2 decimals and thousands separators. */
export function money(x: number): string {
  return round2(x).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Signed amount, e.g. profits: "+1,234.50". */
export function signedMoney(x: number): string {
  const v = round2(x);
  const sign = v > 0 ? "+" : "";
  return sign + money(v);
}

/** Whole shares — floored, with thousands separators. */
export function shares(x: number): string {
  const v = Math.floor(Number.isFinite(x) ? x : 0);
  return v.toLocaleString("en-US");
}

/** Plain integer (no decimals). */
export function int(x: number): string {
  return Math.floor(Number.isFinite(x) ? x : 0).toLocaleString("en-US");
}

/** R multiple, 1 decimal, e.g. "2.0R". */
export function rLabel(multiple: number): string {
  return `${multiple.toFixed(1)}R`;
}
