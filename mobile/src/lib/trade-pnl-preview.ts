/**
 * Client-side Net PnL / R preview — IBKR-style FIFO lots with pro-rata entry
 * fees. Direct port of web/src/lib/tradePnlPreview.ts; keep the math in sync.
 */

import {
  computeInitialRisk,
  effectiveMultiplier,
  parseAmount,
  type TradeFormValues,
} from './trade-form';

export interface PreviewFill {
  side: 'buy' | 'sell';
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

/**
 * Walk fills in order: open lots on the entry side, close FIFO against oldest
 * lots. Closing-leg fees include the exit fee plus pro-rata entry fees
 * consumed from lots.
 */
function fifoRealize(
  side: 'long' | 'short',
  fills: PreviewFill[],
  multiplier: number,
): { realizedNet: number; realizedGross: number; positionQty: number } {
  const mult = multiplier > 0 ? multiplier : 1;
  const openSide = side === 'long' ? 'buy' : 'sell';
  const closeSide = side === 'long' ? 'sell' : 'buy';
  const dirSign = side === 'short' ? -1 : 1;

  const lots: FifoLot[] = [];
  let realizedNet = 0;
  let realizedGross = 0;

  for (const f of fills) {
    const fee = f.fees + f.commission;
    if (f.side === openSide && f.quantity > 0 && f.price > 0) {
      lots.push({ qty: f.quantity, price: f.price, feeRemaining: fee });
      continue;
    }
    if (f.side !== closeSide || f.quantity <= 0 || f.price <= 0) continue;

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

    // Nothing was open to close against.
    if (left >= f.quantity - 1e-9) continue;

    // Only charge exit fees for the qty that actually closed.
    const closedQty = f.quantity - left;
    const exitFeeShare = f.quantity > 0 ? (fee * closedQty) / f.quantity : fee;
    const net = round2(gross - exitFeeShare - entryFees);
    realizedNet = round2(realizedNet + net);
    realizedGross = round2(realizedGross + gross);
  }

  const positionQty = round2(lots.reduce((s, lot) => s + lot.qty, 0));
  return { realizedNet, realizedGross, positionQty };
}

/**
 * Approximate closed-trade PnL from a simple long/short round-trip (or
 * open-only). Realized net uses FIFO lot matching (IBKR-style); averages are
 * fill-weighted.
 */
export function previewTradePnl(
  side: 'long' | 'short',
  fills: PreviewFill[],
  multiplier: number,
  initialRisk: number | null,
): TradePnlPreview {
  const openSide = side === 'long' ? 'buy' : 'sell';
  const closeSide = side === 'long' ? 'sell' : 'buy';

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

/** Preview for one form block: drafts parsed, blank multiplier resolved. */
export function blockPnlPreview(values: TradeFormValues): TradePnlPreview {
  const fills: PreviewFill[] = values.fills.map((fill) => ({
    side: fill.side,
    quantity: parseAmount(fill.quantity) ?? 0,
    price: parseAmount(fill.price) ?? 0,
    fees: parseAmount(fill.fees) ?? 0,
    commission: parseAmount(fill.commission) ?? 0,
  }));
  const multiplier = effectiveMultiplier(values) || 1;
  return previewTradePnl(values.direction, fills, multiplier, computeInitialRisk(values));
}

/** Aggregated preview across multiple symbol trade blocks (one Save batch). */
export interface BatchTradePnlPreview {
  symbolCount: number;
  closedCount: number;
  openCount: number;
  feesTotal: number;
  /** Sum of per-symbol nets; null when no symbol has a closed-leg net yet. */
  net: number | null;
}

export function aggregateTradePnlPreviews(previews: TradePnlPreview[]): BatchTradePnlPreview {
  let closedCount = 0;
  let openCount = 0;
  let feesTotal = 0;
  let netSum = 0;
  let netCount = 0;

  for (const preview of previews) {
    if (preview.avgEntry != null) {
      if (preview.closed) closedCount += 1;
      else openCount += 1;
    }
    feesTotal = round2(feesTotal + preview.feesTotal);
    if (preview.net != null) {
      netSum = round2(netSum + preview.net);
      netCount += 1;
    }
  }

  return {
    symbolCount: previews.length,
    closedCount,
    openCount,
    feesTotal,
    net: netCount > 0 ? netSum : null,
  };
}
