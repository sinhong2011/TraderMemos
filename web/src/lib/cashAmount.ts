/** Signed cash amount for ledger storage (withdrawals/fees negative). */
export function signedCashAmount(type: string, amount: number): number {
  const abs = Math.abs(amount);
  switch (type) {
    case "withdrawal":
    case "fee":
      return -abs;
    case "adjustment":
      return amount;
    default:
      return abs;
  }
}

import { intlLocale } from "./locale";

export function formatCashDisplay(type: string, amount: number, currency: string) {
  const signed = type === "withdrawal" || type === "fee" ? -Math.abs(amount) : amount;
  return signed.toLocaleString(intlLocale(), { style: "currency", currency });
}
