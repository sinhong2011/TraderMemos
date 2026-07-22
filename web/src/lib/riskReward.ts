import type { TradeDetail } from "./api/types";

export interface RiskRewardMetrics {
  entry: number;
  qty: number;
  multiplier: number;
  target: number | null;
  stop: number | null;
  breakeven: number | null;
  maxProfit: number | null;
  maxLoss: number | null;
  plannedRR: number | null;
  holdLabel: string;
}

function fmtHold(secs: number | null): string {
  if (secs == null) return "-";
  if (secs < 60) return "<1m";
  if (secs < 3600) return `${Math.round(secs / 60)}m`;
  const h = Math.floor(secs / 3600);
  const m = Math.round((secs % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function computeRiskReward(trade: TradeDetail): RiskRewardMetrics {
  const entry = trade.avg_entry_price;
  const qty = trade.qty_opened;
  const multiplier = trade.fills[0]?.multiplier ?? (trade.instrument_type === "option" ? 100 : 1);
  const target = trade.target_price;
  const stop = trade.stop_price;
  const isLong = trade.direction === "long";
  const fees = trade.fees_total;

  let breakeven: number | null = null;
  if (qty > 0) {
    const feePerShare = fees / (qty * multiplier);
    breakeven = isLong ? entry + feePerShare : entry - feePerShare;
  }

  let maxProfit: number | null = null;
  let maxLoss: number | null = null;
  let plannedRR: number | null = null;

  if (target != null && qty > 0) {
    const move = isLong ? target - entry : entry - target;
    maxProfit = move * qty * multiplier;
  }
  if (stop != null && qty > 0) {
    const move = isLong ? entry - stop : stop - entry;
    maxLoss = -Math.abs(move * qty * multiplier);
  }
  if (target != null && stop != null) {
    const reward = isLong ? target - entry : entry - target;
    const risk = isLong ? entry - stop : stop - entry;
    if (risk > 0) plannedRR = reward / risk;
  }

  return {
    entry,
    qty,
    multiplier,
    target,
    stop,
    breakeven,
    maxProfit,
    maxLoss,
    plannedRR,
    holdLabel: fmtHold(trade.time_in_trade_secs),
  };
}
