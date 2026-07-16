/** Client-side Net PnL / R preview matching the fill regroup engine (simplified). */

export interface PreviewFill {
  side: "buy" | "sell";
  quantity: number;
  price: number;
  fees: number;
  commission: number;
}

export interface TradePnlPreview {
  gross: number | null;
  feesTotal: number;
  net: number | null;
  rMultiple: number | null;
  closed: boolean;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Approximate closed-trade PnL from a simple long/short round-trip (or open-only).
 * Uses last fill multiplier; mirrors engine finalize for a single pair of sides.
 */
export function previewTradePnl(
  side: "long" | "short",
  fills: PreviewFill[],
  multiplier: number,
  initialRisk: number | null,
): TradePnlPreview {
  const mult = multiplier > 0 ? multiplier : 1;
  const openSide = side === "long" ? "buy" : "sell";
  const closeSide = side === "long" ? "sell" : "buy";

  let entryNotional = 0;
  let entryQty = 0;
  let exitNotional = 0;
  let exitQty = 0;
  let feesTotal = 0;

  for (const f of fills) {
    feesTotal += f.fees + f.commission;
    if (f.side === openSide) {
      entryNotional += f.price * f.quantity;
      entryQty += f.quantity;
    } else if (f.side === closeSide) {
      exitNotional += f.price * f.quantity;
      exitQty += f.quantity;
    }
  }

  feesTotal = round2(feesTotal);

  if (entryQty <= 0) {
    return { gross: null, feesTotal, net: null, rMultiple: null, closed: false };
  }

  if (exitQty <= 0) {
    return { gross: null, feesTotal, net: null, rMultiple: null, closed: false };
  }

  const closedQty = Math.min(entryQty, exitQty);
  const avgEntry = entryNotional / entryQty;
  const avgExit = exitNotional / exitQty;
  const dirSign = side === "short" ? -1 : 1;
  const gross = round2((avgExit - avgEntry) * closedQty * dirSign * mult);
  const net = round2(gross - feesTotal);
  let rMultiple: number | null = null;
  if (initialRisk != null && initialRisk !== 0) {
    rMultiple = round2(net / initialRisk);
  }
  return { gross, feesTotal, net, rMultiple, closed: true };
}
