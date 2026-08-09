import type { BarInterval, MarketBar } from "@/lib/api/market";
import type { Execution } from "@/lib/api/types";
import { INTERVAL_SEC } from "./barsToCandlestickData";

export interface ExcursionPoint {
  /** Bar open time, unix seconds UTC. */
  time: number;
  /** Gross open equity (realized + mark-to-market, fees excluded) at the bar close. */
  equity: number;
}

export interface ExcursionSeries {
  points: ExcursionPoint[];
  /** Deepest equity dip below zero, as a positive magnitude (gross). */
  mae: number;
  /** Highest equity peak above zero (gross). */
  mfe: number;
}

/**
 * Restrict server bars to the holding window (± one bar of context). The bars
 * endpoint pads the requested range for chart context and cached responses can
 * carry strays far outside it; the excursion picture is the holding window only.
 */
export function trimBarsToHold(
  bars: MarketBar[],
  interval: BarInterval,
  openedAt: string,
  closedAt: string,
): MarketBar[] {
  const step = INTERVAL_SEC[interval];
  const opened = Math.floor(new Date(openedAt).getTime() / 1000);
  const closed = Math.floor(new Date(closedAt).getTime() / 1000);
  return bars.filter((b) => b.time >= opened - step && b.time <= closed + step);
}

/**
 * Bar-by-bar open-equity curve for the holding window — the picture behind the
 * MAE/MFE numbers. Mirrors api/internal/excursion.Compute: equity starts at 0,
 * fills replay with weighted-avg cost / scale-ins / flips (same walk as
 * computeReplayPnl), and the envelope is probed at every bar high/low and at
 * every fill price, so the returned mae/mfe can exceed the close-marked curve.
 */
export function computeExcursionSeries(
  fills: Execution[],
  bars: MarketBar[],
  interval: BarInterval,
): ExcursionSeries | null {
  if (bars.length < 2 || fills.length === 0) return null;

  const step = INTERVAL_SEC[interval];
  const sorted = [...fills].sort(
    (a, b) => new Date(a.executed_at).getTime() - new Date(b.executed_at).getTime(),
  );
  const lastCutoff = bars[bars.length - 1]!.time + step;
  if (!sorted.some((f) => Math.floor(new Date(f.executed_at).getTime() / 1000) < lastCutoff)) {
    return null;
  }

  let position = 0;
  let avgCost = 0;
  let realized = 0;
  let lastMult = 1;
  let minEq = 0;
  let maxEq = 0;
  let next = 0;

  const equityAt = (price: number): number =>
    position === 0 ? realized : realized + (price - avgCost) * position * lastMult;

  const probe = (price: number) => {
    const eq = equityAt(price);
    if (eq < minEq) minEq = eq;
    if (eq > maxEq) maxEq = eq;
  };

  const apply = (f: Execution) => {
    const mult = f.multiplier > 0 ? f.multiplier : 1;
    lastMult = mult;
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
    probe(f.price);
  };

  const points: ExcursionPoint[] = [];

  for (const bar of bars) {
    const cutoff = bar.time + step;
    while (next < sorted.length) {
      const f = sorted[next]!;
      if (Math.floor(new Date(f.executed_at).getTime() / 1000) >= cutoff) break;
      next++;
      apply(f);
    }

    if (next > 0) {
      probe(bar.low);
      probe(bar.high);
    }
    points.push({ time: bar.time, equity: equityAt(bar.close) });
  }

  // Fills past the last bar (e.g. an after-hours exit beyond the tape): apply
  // them and settle the curve at the resulting equity so it doesn't end mid-air.
  if (next < sorted.length) {
    let lastPrice = 0;
    while (next < sorted.length) {
      const f = sorted[next]!;
      next++;
      apply(f);
      lastPrice = f.price;
    }
    points.push({ time: lastCutoff, equity: equityAt(lastPrice) });
  }

  return { points, mae: Math.max(0, -minEq), mfe: Math.max(0, maxEq) };
}
