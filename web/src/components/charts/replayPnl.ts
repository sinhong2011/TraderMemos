import type { BarInterval, MarketBar } from "@/lib/api/market";
import type { Execution } from "@/lib/api/types";
import { INTERVAL_SEC } from "./barsToCandlestickData";
import { CHART_TIME_ZONE } from "./chartTime";

/**
 * The fill fields the replay math reads — real Executions and the synthetic
 * fills a backtest session fabricates both satisfy it.
 */
export type ReplayFillInput = Pick<
  Execution,
  "side" | "quantity" | "price" | "fees" | "commission" | "executed_at" | "multiplier"
>;

export interface ReplayPnl {
  /** Signed open quantity at the cursor (+long / -short). */
  position: number;
  /** Weighted average entry price of the open position. */
  avgCost: number;
  /** Gross realized P&L from fills at or before the cursor bar. */
  realized: number;
  /** Mark-to-market P&L of the open position at the cursor bar close. */
  unrealized: number;
  /** Fees + commission of fills at or before the cursor bar. */
  fees: number;
  /** realized + unrealized - fees. */
  net: number;
  /** Fills consumed so far. */
  fillCount: number;
}

/**
 * Exclusive end of the cursor bar — fills strictly before it have happened.
 * A fill stamped exactly at the next bar's open belongs to the next bar.
 */
export function replayCutoff(bars: MarketBar[], cursor: number, interval: BarInterval): number {
  return bars[cursor]!.time + INTERVAL_SEC[interval];
}

/**
 * Replay fills bar-by-bar and mark the open position to the cursor bar close.
 * Mirrors api/internal/excursion.Compute: weighted-avg cost, scale-ins,
 * partial exits, and flips (remainder re-opens at the flip fill's price).
 */
export function computeReplayPnl(
  fills: ReplayFillInput[],
  bars: MarketBar[],
  cursor: number,
  interval: BarInterval,
): ReplayPnl | null {
  const bar = bars[cursor];
  if (!bar) return null;

  const cutoff = replayCutoff(bars, cursor, interval);
  const passed = fills
    .filter((f) => Math.floor(new Date(f.executed_at).getTime() / 1000) < cutoff)
    .sort((a, b) => new Date(a.executed_at).getTime() - new Date(b.executed_at).getTime());

  let position = 0;
  let avgCost = 0;
  let realized = 0;
  let fees = 0;
  let lastMult = 1;

  for (const f of passed) {
    const mult = f.multiplier > 0 ? f.multiplier : 1;
    lastMult = mult;
    fees += (f.fees ?? 0) + (f.commission ?? 0);
    const qty = f.side === "buy" ? f.quantity : -f.quantity;

    if (position === 0 || Math.sign(qty) === Math.sign(position)) {
      const total = Math.abs(position) + Math.abs(qty);
      avgCost = total > 0 ? (avgCost * Math.abs(position) + f.price * Math.abs(qty)) / total : 0;
      position += qty;
    } else {
      const closeQty = Math.min(Math.abs(qty), Math.abs(position));
      realized += (f.price - avgCost) * closeQty * Math.sign(position) * mult;
      const remainder = Math.abs(qty) - closeQty;
      position += qty;
      if (remainder > 0) {
        avgCost = f.price;
      } else if (position === 0) {
        avgCost = 0;
      }
    }
  }

  const unrealized = position === 0 ? 0 : (bar.close - avgCost) * position * lastMult;
  return {
    position,
    avgCost,
    realized,
    unrealized,
    fees,
    net: realized + unrealized - fees,
    fillCount: passed.length,
  };
}

/** Fractional slack beyond a bar's range before a fill counts as mismatched. */
const FILL_BAR_TOLERANCE = 0.01;

/**
 * True when any fill's price lands far outside its containing bar's range —
 * the chart tape and the recorded fills disagree (hand-entered or seeded
 * prices), so mark-to-market replay P&L is unreliable until the exit.
 */
export function detectFillBarMismatch(
  fills: Execution[],
  bars: MarketBar[],
  interval: BarInterval,
): boolean {
  const step = INTERVAL_SEC[interval];
  return fills.some((f) => {
    const t = Math.floor(new Date(f.executed_at).getTime() / 1000);
    const bar = bars.find((b) => t >= b.time && t < b.time + step);
    if (!bar) return false;
    const slack = Math.max(bar.high - bar.low, bar.high * FILL_BAR_TOLERANCE);
    return f.price < bar.low - slack || f.price > bar.high + slack;
  });
}

/** Cursor bar timestamp for the replay readout, on the chart's Eastern clock. */
export function formatReplayBarTime(utcSec: number, interval: BarInterval, locale: string): string {
  const opts: Intl.DateTimeFormatOptions =
    interval === "D"
      ? { month: "short", day: "numeric", timeZone: CHART_TIME_ZONE }
      : {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: CHART_TIME_ZONE,
        };
  return new Intl.DateTimeFormat(locale, opts).format(new Date(utcSec * 1000));
}
