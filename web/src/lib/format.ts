export function fmtMoney(v: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(v);
}
export function fmtSignedMoney(v: number, currency: string, locale: string): string {
  const s = fmtMoney(Math.abs(v), currency, locale);
  return v < 0 ? `-${s}` : `+${s}`;
}
export function fmtPct(ratio: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(ratio);
}
