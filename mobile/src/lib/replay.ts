/**
 * Bar-by-bar trade replay — P&L math ported from
 * web/src/components/charts/replayPnl.ts, plus the playback controller hook
 * (useReplayController). Keep the math in sync with the web file and
 * api/internal/excursion.Compute.
 *
 * The web version recomputes one bar at a time from the cursor. Here the whole
 * run is materialised up front instead (`computeReplayRun`): the readout wants
 * figures that only exist across the series — run MAE/MFE, the moment the stop
 * was touched, the equity curve under the scrubber — and one pass is cheaper
 * than the per-frame recompute it replaces.
 */

import { useEffect, useMemo, useState } from 'react';

import type { BarInterval, Execution, MarketBar } from '@/api/types';
import { storage } from '@/storage/mmkv';

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

/** Running state of the position, for the readout's one-word verdict. */
export type ReplayState = 'flat' | 'long' | 'short' | 'closed';

export interface ReplayFrame extends ReplayPnl {
  /** Unix seconds of this bar's open. */
  barTime: number;
  close: number;
  state: ReplayState;
  /** Best / worst net seen at or before this bar — the run's own MFE / MAE. */
  peak: number;
  trough: number;
  /** net / initial risk, when the trade recorded a risk figure. */
  rMultiple: number | null;
}

export interface ReplayRun {
  frames: ReplayFrame[];
  /** First bar whose range touched the stop / target while a position was open. */
  stopTouch: number | null;
  targetTouch: number | null;
  /** Extremes across the whole run. */
  best: number;
  worst: number;
  /** True when the recorded fills disagree with the tape (see below). */
  mismatch: boolean;
}

const EMPTY_RUN: ReplayRun = {
  frames: [],
  stopTouch: null,
  targetTouch: null,
  best: 0,
  worst: 0,
  mismatch: false,
};

/** Mutable position state threaded through the bar walk. */
interface Book {
  position: number;
  avgCost: number;
  realized: number;
  fees: number;
  lastMult: number;
}

/**
 * Apply one fill to the book. Mirrors api/internal/excursion.Compute:
 * weighted-avg cost, scale-ins, partial exits, and flips (the remainder
 * re-opens at the flip fill's price).
 */
function applyFill(book: Book, fill: Execution): void {
  const mult = fill.multiplier > 0 ? fill.multiplier : 1;
  book.lastMult = mult;
  book.fees += (fill.fees ?? 0) + (fill.commission ?? 0);
  const qty = fill.side === 'buy' ? fill.quantity : -fill.quantity;

  if (book.position === 0 || Math.sign(qty) === Math.sign(book.position)) {
    const total = Math.abs(book.position) + Math.abs(qty);
    book.avgCost =
      total > 0
        ? (book.avgCost * Math.abs(book.position) + fill.price * Math.abs(qty)) / total
        : 0;
    book.position += qty;
    return;
  }

  const closeQty = Math.min(Math.abs(qty), Math.abs(book.position));
  book.realized += (fill.price - book.avgCost) * closeQty * Math.sign(book.position) * mult;
  const remainder = Math.abs(qty) - closeQty;
  book.position += qty;
  if (remainder > 0) book.avgCost = fill.price;
  else if (book.position === 0) book.avgCost = 0;
}

function fillSeconds(fill: Execution): number {
  return Math.floor(new Date(fill.executed_at).getTime() / 1000);
}

function stateOf(position: number, fillCount: number, fillTotal: number): ReplayState {
  if (position > 0) return 'long';
  if (position < 0) return 'short';
  // Zero position: "closed" only once every fill has been consumed, so the
  // flat moments before entry and between round trips stay distinguishable.
  return fillCount > 0 && fillCount >= fillTotal ? 'closed' : 'flat';
}

export interface ReplayRunInput {
  fills: Execution[];
  bars: MarketBar[];
  interval: BarInterval;
  /** Trade's recorded risk, for the R readout. Non-positive is treated as absent. */
  initialRisk?: number | null;
  stopPrice?: number | null;
  targetPrice?: number | null;
}

/**
 * Walk the bars once, consuming fills as their bar passes, and record a frame
 * per bar. Fills are sorted and pointer-advanced rather than re-filtered per
 * bar, so the run is O(bars + fills).
 */
export function computeReplayRun({
  fills,
  bars,
  interval,
  initialRisk,
  stopPrice,
  targetPrice,
}: ReplayRunInput): ReplayRun {
  if (bars.length === 0) return EMPTY_RUN;

  const step = INTERVAL_SEC[interval];
  const ordered = [...fills].sort((a, b) => fillSeconds(a) - fillSeconds(b));
  const risk = initialRisk != null && initialRisk > 0 ? initialRisk : null;

  const book: Book = { position: 0, avgCost: 0, realized: 0, fees: 0, lastMult: 1 };
  const frames: ReplayFrame[] = [];
  let next = 0;
  let peak = 0;
  let trough = 0;
  let stopTouch: number | null = null;
  let targetTouch: number | null = null;

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i]!;
    const cutoff = bar.time + step;
    while (next < ordered.length && fillSeconds(ordered[next]!) < cutoff) {
      applyFill(book, ordered[next]!);
      next += 1;
    }

    const unrealized =
      book.position === 0 ? 0 : (bar.close - book.avgCost) * book.position * book.lastMult;
    const net = book.realized + unrealized - book.fees;
    if (net > peak) peak = net;
    if (net < trough) trough = net;

    // A level only counts as touched while there is something at risk.
    if (book.position !== 0) {
      if (stopTouch == null && stopPrice != null && bar.low <= stopPrice && stopPrice <= bar.high) {
        stopTouch = i;
      }
      if (
        targetTouch == null &&
        targetPrice != null &&
        bar.low <= targetPrice &&
        targetPrice <= bar.high
      ) {
        targetTouch = i;
      }
    }

    frames.push({
      position: book.position,
      avgCost: book.avgCost,
      realized: book.realized,
      unrealized,
      fees: book.fees,
      net,
      fillCount: next,
      barTime: bar.time,
      close: bar.close,
      state: stateOf(book.position, next, ordered.length),
      peak,
      trough,
      rMultiple: risk != null ? net / risk : null,
    });
  }

  return {
    frames,
    stopTouch,
    targetTouch,
    best: peak,
    worst: trough,
    mismatch: detectFillBarMismatch(fills, bars, interval),
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
    const t = fillSeconds(f);
    const bar = bars.find((b) => t >= b.time && t < b.time + step);
    if (!bar) return false;
    const slack = Math.max(bar.high - bar.low, bar.high * FILL_BAR_TOLERANCE);
    return f.price < bar.low - slack || f.price > bar.high + slack;
  });
}

/** Memoised `computeReplayRun` — the input identities are what change per render. */
export function useReplayRun(input: ReplayRunInput): ReplayRun {
  const { fills, bars, interval, initialRisk, stopPrice, targetPrice } = input;
  return useMemo(
    () => computeReplayRun({ fills, bars, interval, initialRisk, stopPrice, targetPrice }),
    [fills, bars, interval, initialRisk, stopPrice, targetPrice],
  );
}

// ---------------------------------------------------------------------------
// Playback controller
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

const SPEED_KEY = 'replay:speed';

function isSpeed(value: string | undefined): value is ReplaySpeed {
  return value === '1' || value === '2' || value === '5' || value === '10';
}

/** Playback rate outlives the screen — it is a preference, not a per-trade choice. */
function loadSpeed(): ReplaySpeed {
  try {
    const stored = storage.getString(SPEED_KEY);
    return isSpeed(stored) ? stored : '2';
  } catch {
    return '2';
  }
}

export interface ReplayController {
  cursor: number;
  playing: boolean;
  speed: ReplaySpeed;
  /** 0…1 across the bar set — drives the scrub track. */
  progress: number;
  atEnd: boolean;
  toggle: () => void;
  restart: () => void;
  stepBack: () => void;
  stepForward: () => void;
  seek: (index: number) => void;
  setSpeed: (speed: ReplaySpeed) => void;
}

/**
 * Bar-by-bar playback state. The cursor indexes into the bars array; playback
 * advances it on a timer and auto-pauses on the last bar. Cursor resets
 * whenever the bar set changes (interval switch, refetch).
 *
 * `autoStart` is for the full-screen theater, which exists only to play —
 * opening it and finding a paused chart would be a wasted tap.
 */
export function useReplayController(barCount: number, autoStart = false): ReplayController {
  const [cursor, setCursor] = useState(0);
  // Bars usually arrive after mount (the count change below starts playback),
  // but a cached bar set is already here on the first render — so seed from it
  // too, or the theater opens paused on bar 0 whenever the query was warm.
  const [playing, setPlaying] = useState(autoStart && barCount > 1);
  const [speed, setSpeedState] = useState<ReplaySpeed>(loadSpeed);

  const lastIndex = Math.max(barCount - 1, 0);

  // Cursor resets when the bar set changes (interval switch, refetch) —
  // adopt-during-render, since the compiler bans setState inside effects.
  const [prevCount, setPrevCount] = useState(barCount);
  if (prevCount !== barCount) {
    setPrevCount(barCount);
    setCursor(0);
    setPlaying(barCount > 1 && autoStart);
  }

  useEffect(() => {
    if (!playing || barCount === 0) return;
    const id = setInterval(() => {
      setCursor((c) => {
        const next = Math.min(c + 1, lastIndex);
        // Auto-pause on the final bar, from inside the tick (not an effect).
        if (next >= lastIndex) setPlaying(false);
        return next;
      });
    }, SPEED_MS[speed]);
    return () => clearInterval(id);
  }, [playing, speed, barCount, lastIndex]);

  const clamp = (i: number) => Math.min(Math.max(i, 0), lastIndex);

  return {
    cursor,
    playing,
    speed,
    progress: lastIndex > 0 ? cursor / lastIndex : 0,
    atEnd: cursor >= lastIndex && lastIndex > 0,
    toggle: () => {
      // Replaying from the end restarts rather than sticking on the last bar.
      if (!playing && cursor >= lastIndex) setCursor(0);
      setPlaying((p) => !p);
    },
    restart: () => {
      setCursor(0);
      setPlaying(true);
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
    setSpeed: (next: ReplaySpeed) => {
      setSpeedState(next);
      try {
        storage.set(SPEED_KEY, next);
      } catch {
        // A read-only store costs the preference, not the playback.
      }
    },
  };
}
