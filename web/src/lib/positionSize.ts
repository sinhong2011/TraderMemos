/** Position size from account equity, risk %, entry, and stop. */
export function positionSizeFromRisk(opts: {
  equity: number;
  riskPct: number;
  entryPrice: number;
  stopPrice: number;
  multiplier?: number;
}): { qty: number; riskDollars: number; perShareRisk: number } | null {
  const mult = opts.multiplier && opts.multiplier > 0 ? opts.multiplier : 1;
  if (
    !(opts.equity > 0) ||
    !(opts.riskPct > 0) ||
    !(opts.entryPrice > 0) ||
    !(opts.stopPrice > 0)
  ) {
    return null;
  }
  const perShare = Math.abs(opts.entryPrice - opts.stopPrice) * mult;
  if (perShare <= 0) return null;
  const riskDollars = (opts.equity * opts.riskPct) / 100;
  const qty = riskDollars / perShare;
  if (!(qty > 0)) return null;
  return {
    qty: Math.floor(qty * 100) / 100,
    riskDollars: Math.round(riskDollars * 100) / 100,
    perShareRisk: Math.round(perShare * 100) / 100,
  };
}
