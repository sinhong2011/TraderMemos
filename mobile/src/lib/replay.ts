/**
 * Bar-by-bar trade replay — P&L math ported verbatim from
 * web/src/components/charts/replayPnl.ts, plus the playback controller hook
 * (useReplayController). Keep the math in sync with the web file and
 * api/internal/excursion.Compute.
 */

import { useEffect, useState } from 'react';

import type { BarInterval, Execution, MarketBar } from '@/api/types';

/** Seconds covered by one bar of each wire interval. */
export const INTERVAL_SEC: Record<BarInterval, number> = {
  '1': 60,
  '5': 300,
  '15': 900,
  '60': 3600,
  '240': 14_400,
  D: 86_400,
};

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
  fills: Execution[],
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
    const qty = f.side === 'buy' ? f.quantity : -f.quantity;

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

// ---------------------------------------------------------------------------
// Playback controller (web useReplayController)
// ---------------------------------------------------------------------------

export type ReplaySpeed = '1' | '2' | '5' | '10';

/** Milliseconds per bar at each speed. */
const SPEED_MS: Record<ReplaySpeed, number> = { '1': 600, '2': 300, '5': 120, '10': 60 };

export const REPLAY_SPEEDS = [
  { value: '1' as const, label: '1×' },
  { value: '2' as const, label: '2×' },
  { value: '5' as const, label: '5×' },
  { value: '10' as const, label: '10×' },
];

export interface ReplayController {
  active: boolean;
  cursor: number;
  playing: boolean;
  speed: ReplaySpeed;
  start: () => void;
  exit: () => void;
  toggle: () => void;
  stepBack: () => void;
  stepForward: () => void;
  seek: (index: number) => void;
  setSpeed: (speed: ReplaySpeed) => void;
}

/**
 * Bar-by-bar playback state for trade replay. The cursor indexes into the
 * bars array; playback advances it on a timer and auto-pauses on the last bar.
 * Cursor resets whenever the bar set changes (interval switch, refetch).
 */
export function useReplayController(barCount: number): ReplayController {
  const [active, setActive] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<ReplaySpeed>('2');

  const lastIndex = Math.max(barCount - 1, 0);

  // Cursor resets when the bar set changes (interval switch, refetch) —
  // adopt-during-render, since the compiler bans setState inside effects.
  const [prevCount, setPrevCount] = useState(barCount);
  if (prevCount !== barCount) {
    setPrevCount(barCount);
    setCursor(0);
    setPlaying(false);
  }

  useEffect(() => {
    if (!active || !playing || barCount === 0) return;
    const id = setInterval(() => {
      setCursor((c) => {
        const next = Math.min(c + 1, lastIndex);
        // Auto-pause on the final bar, from inside the tick (not an effect).
        if (next >= lastIndex) setPlaying(false);
        return next;
      });
    }, SPEED_MS[speed]);
    return () => clearInterval(id);
  }, [active, playing, speed, barCount, lastIndex]);

  const clamp = (i: number) => Math.min(Math.max(i, 0), lastIndex);

  return {
    active,
    cursor,
    playing,
    speed,
    start: () => {
      setActive(true);
      setCursor(0);
      setPlaying(true);
    },
    exit: () => {
      setActive(false);
      setPlaying(false);
      setCursor(0);
    },
    toggle: () => {
      if (!playing && cursor >= lastIndex) setCursor(0);
      setPlaying((p) => !p);
    },
    stepBack: () => {
      setPlaying(false);
      setCursor((c) => clamp(c - 1));
    },
    stepForward: () => {
      setPlaying(false);
      setCursor((c) => clamp(c + 1));
    },
    seek: (index: number) => {
      setPlaying(false);
      setCursor(clamp(index));
    },
    setSpeed,
  };
}
