/** Client-side Net PnL / R preview — IBKR-style FIFO lots with pro-rata entry fees. */

export interface PreviewFill {
  side: "buy" | "sell";
  quantity: number;
  price: number;
  fees: number;
  commission: number;
}

export interface TradePnlPreview {
  avgEntry: number | null;
  avgExit: number | null;
  /** Remaining open qty (entry − exit). 0 when flat. */
  positionQty: number;
  gross: number | null;
  feesTotal: number;
  net: number | null;
  rMultiple: number | null;
  closed: boolean;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type FifoLot = {
  qty: number;
  price: number;
  /** Entry fee+commission remaining on this lot (pro-rata as qty shrinks). */
  feeRemaining: number;
};

type FifoCloseResult = {
  /** Per-fill net P&L; null for opening legs or uncloseable qty. */
  fillPnls: (number | null)[];
  /** Sum of closing-leg nets (realized). */
  realizedNet: number;
  /** Price P&L before fees on closed lots. */
  realizedGross: number;
  /** Qty still open after walking fills in order. */
  positionQty: number;
  /** Remaining open lots (for diagnostics). */
  openLots: FifoLot[];
};

/**
 * Walk fills in order: open lots on the entry side, close FIFO against oldest lots.
 * Closing-leg fees include the exit fee plus pro-rata entry fees consumed from lots.
 */
function fifoRealize(
  side: "long" | "short",
  fills: PreviewFill[],
  multiplier: number,
): FifoCloseResult {
  const mult = multiplier > 0 ? multiplier : 1;
  const openSide = side === "long" ? "buy" : "sell";
  const closeSide = side === "long" ? "sell" : "buy";
  const dirSign = side === "short" ? -1 : 1;

  const lots: FifoLot[] = [];
  const fillPnls: (number | null)[] = [];
  let realizedNet = 0;
  let realizedGross = 0;

  for (const f of fills) {
    const fee = f.fees + f.commission;
    if (f.side === openSide && f.quantity > 0 && f.price > 0) {
      lots.push({ qty: f.quantity, price: f.price, feeRemaining: fee });
      fillPnls.push(null);
      continue;
    }
    if (f.side !== closeSide || f.quantity <= 0 || f.price <= 0) {
      fillPnls.push(null);
      continue;
    }

    let left = f.quantity;
    let gross = 0;
    let entryFees = 0;
    while (left > 0 && lots.length > 0) {
      const lot = lots[0]!;
      const take = Math.min(left, lot.qty);
      const feeTake = lot.qty > 0 ? (lot.feeRemaining * take) / lot.qty : 0;
      gross += (f.price - lot.price) * take * dirSign * mult;
      entryFees += feeTake;
      lot.qty = round2(lot.qty - take);
      lot.feeRemaining = Math.max(0, lot.feeRemaining - feeTake);
      left = round2(left - take);
      if (lot.qty <= 1e-9) lots.shift();
    }

    if (left >= f.quantity - 1e-9) {
      // Nothing was open to close against.
      fillPnls.push(null);
      continue;
    }

    // Only charge exit fees for the qty that actually closed.
    const closedQty = f.quantity - left;
    const exitFeeShare = f.quantity > 0 ? (fee * closedQty) / f.quantity : fee;
    const net = round2(gross - exitFeeShare - entryFees);
    fillPnls.push(net);
    realizedNet = round2(realizedNet + net);
    realizedGross = round2(realizedGross + gross);
  }

  const positionQty = round2(lots.reduce((s, lot) => s + lot.qty, 0));
  return { fillPnls, realizedNet, realizedGross, positionQty, openLots: lots };
}

/**
 * Approximate closed-trade PnL from a simple long/short round-trip (or open-only).
 * Realized net uses FIFO lot matching (IBKR-style); averages are fill-weighted.
 */
export function previewTradePnl(
  side: "long" | "short",
  fills: PreviewFill[],
  multiplier: number,
  initialRisk: number | null,
): TradePnlPreview {
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
  const avgEntry = entryQty > 0 ? entryNotional / entryQty : null;
  const avgExit = exitQty > 0 ? exitNotional / exitQty : null;
  const fifo = fifoRealize(side, fills, multiplier);
  const positionQty = fifo.positionQty;

  if (entryQty <= 0) {
    return {
      avgEntry: null,
      avgExit: null,
      positionQty: 0,
      gross: null,
      feesTotal,
      net: null,
      rMultiple: null,
      closed: false,
    };
  }

  if (exitQty <= 0) {
    return {
      avgEntry,
      avgExit,
      positionQty,
      gross: null,
      feesTotal,
      net: null,
      rMultiple: null,
      closed: false,
    };
  }

  const gross = fifo.realizedGross;
  const net = fifo.realizedNet;
  let rMultiple: number | null = null;
  if (initialRisk != null && initialRisk !== 0) {
    rMultiple = round2(net / initialRisk);
  }
  return {
    avgEntry,
    avgExit,
    positionQty,
    gross,
    feesTotal,
    net,
    rMultiple,
    closed: positionQty === 0,
  };
}

/** Aggregated preview across multiple symbol trade blocks (one Save batch). */
export interface BatchTradePnlPreview {
  symbolCount: number;
  /** Symbols with at least one priced fill (entry or exit). */
  withFills: number;
  closedCount: number;
  openCount: number;
  feesTotal: number;
  /** Sum of per-symbol nets; null when no symbol has a closed-leg net yet. */
  net: number | null;
  riskTotal: number | null;
  rMultiple: number | null;
}

export function aggregateTradePnlPreviews(
  items: Array<{ preview: TradePnlPreview; initialRisk?: number | null }>,
): BatchTradePnlPreview {
  let withFills = 0;
  let closedCount = 0;
  let openCount = 0;
  let feesTotal = 0;
  let netSum = 0;
  let netCount = 0;
  let riskSum = 0;
  let riskCount = 0;

  for (const { preview, initialRisk } of items) {
    const hasFill = preview.avgEntry != null || preview.avgExit != null || preview.feesTotal > 0;
    if (hasFill) withFills += 1;
    if (preview.avgEntry != null) {
      if (preview.closed) closedCount += 1;
      else openCount += 1;
    }
    feesTotal = round2(feesTotal + preview.feesTotal);
    if (preview.net != null) {
      netSum = round2(netSum + preview.net);
      netCount += 1;
    }
    if (initialRisk != null && initialRisk > 0) {
      riskSum = round2(riskSum + initialRisk);
      riskCount += 1;
    }
  }

  const net = netCount > 0 ? netSum : null;
  const riskTotal = riskCount > 0 ? riskSum : null;
  const rMultiple =
    net != null && riskTotal != null && riskTotal !== 0 ? round2(net / riskTotal) : null;

  return {
    symbolCount: items.length,
    withFills,
    closedCount,
    openCount,
    feesTotal,
    net,
    riskTotal,
    rMultiple,
  };
}

/**
 * Per-fill net P&L for closing legs (sells on long / buys on short).
 * FIFO lot matching + pro-rata entry fees (IBKR-style row P&L).
 * Opening fills return null.
 */
export function previewFillNetPnls(
  side: "long" | "short",
  fills: PreviewFill[],
  multiplier: number,
): (number | null)[] {
  return fifoRealize(side, fills, multiplier).fillPnls;
}
