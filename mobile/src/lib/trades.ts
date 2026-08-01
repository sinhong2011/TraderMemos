/** Trade derivations ported from web/src/components/tradeColumns.tsx. */

import type { Trade } from '@/api/types';
import type { PillTone } from '@/components/pill';

const MARKET_LABELS: Record<string, string> = {
  stock: 'STK',
  option: 'OPT',
  crypto: 'CRY',
  futures: 'FUT',
  forex: 'FX',
};

export function marketLabel(instrumentType: string): string {
  return MARKET_LABELS[instrumentType] ?? instrumentType.slice(0, 3).toUpperCase();
}

/** Options settle ×100 — without this a 1-contract P&L never reconciles. */
export function tradeNotionalMultiplier(instrumentType: string): number {
  return instrumentType === 'option' ? 100 : 1;
}

export function tradeNotional(trade: Trade): number {
  return trade.qty_opened * trade.avg_entry_price * tradeNotionalMultiplier(trade.instrument_type);
}

export type TradeStatusLabel = 'WIN' | 'LOSS' | 'OPEN' | 'BE';

export function tradeStatus(trade: Trade): { label: TradeStatusLabel; tone: PillTone } {
  if (trade.status === 'open') return { label: 'OPEN', tone: 'accent' };
  if (trade.net_pnl != null && trade.net_pnl > 0) return { label: 'WIN', tone: 'pos' };
  if (trade.net_pnl != null && trade.net_pnl < 0) return { label: 'LOSS', tone: 'neg' };
  return { label: 'BE', tone: 'muted' };
}

/** Net P&L ÷ planned risk when journal initial_risk is set. */
export function tradeRMultiple(trade: Trade): number | null {
  if (trade.initial_risk == null || trade.initial_risk <= 0 || trade.net_pnl == null) return null;
  return trade.net_pnl / trade.initial_risk;
}

/** "12 @ $3.20 → $3.05" — size at entry, then the exit once there is one. */
export function tradePriceLine(trade: Trade, format: (v: number) => string): string {
  const qty = trade.qty_opened.toFixed(trade.qty_opened % 1 === 0 ? 0 : 2);
  const entry = format(trade.avg_entry_price);
  if (trade.avg_exit_price == null) return `${qty} @ ${entry}`;
  return `${qty} @ ${entry} → ${format(trade.avg_exit_price)}`;
}
