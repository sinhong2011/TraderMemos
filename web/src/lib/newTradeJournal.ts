export function computeInitialRisk(
  side: "long" | "short",
  entryPrice: number,
  qty: number,
  stopPrice: number | null,
): number | null {
  if (stopPrice == null || entryPrice <= 0 || qty <= 0) return null;
  const perShare = side === "long" ? entryPrice - stopPrice : stopPrice - entryPrice;
  if (perShare <= 0) return null;
  return perShare * qty;
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

/** Notes only — emotion/confidence/quality are structured journal columns. */
export function buildJournalNotes(opts: { notes: string }): string {
  return opts.notes.trim();
}

export const EMOTIONAL_STATES = [
  "Calm",
  "Focused",
  "Anxious",
  "FOMO",
  "Revenge",
  "Overconfident",
  "Tired",
] as const;
