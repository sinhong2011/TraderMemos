export function computeInitialRisk(
  side: "long" | "short",
  entryPrice: number,
  qty: number,
  stopPrice: number | null,
  multiplier = 1,
): number | null {
  if (stopPrice == null || entryPrice <= 0 || qty <= 0) return null;
  const perShare = side === "long" ? entryPrice - stopPrice : stopPrice - entryPrice;
  if (perShare <= 0) return null;
  const mult = multiplier > 0 ? multiplier : 1;
  return perShare * qty * mult;
}

export function weightedAvgEntry(
  rows: { side: "buy" | "sell"; quantity: number; price: number }[],
  side: "long" | "short",
): { qty: number; avg: number } | null {
  const openSide = side === "long" ? "buy" : "sell";
  const opens = rows.filter((r) => r.side === openSide);
  if (opens.length === 0) return null;
  const qty = opens.reduce((s, r) => s + r.quantity, 0);
  if (qty <= 0) return null;
  const notional = opens.reduce((s, r) => s + r.quantity * r.price, 0);
  return { qty, avg: notional / qty };
}

export { EMOTIONAL_STATES } from "./tradeGrades";
export { buildStructuredJournalNotes, parseJournalNotes } from "./journalNotes";
