/**
 * The bar window a chart shows for a trade, and the interval to show it at.
 *
 * Shared by the trade card and the replay theater so both land on the same
 * candles — a replay that silently used a different resolution than the chart
 * you opened it from would report a different P&L path for the same trade.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { useMarketBars } from '@/api/hooks';
import type { BarInterval, MarketBar } from '@/api/types';

/** Same thresholds as web `defaultBarInterval`: pick resolution from duration. */
export function defaultInterval(fromMs: number, toMs: number): BarInterval {
  const ms = Math.max(toMs - fromMs, 60_000);
  if (ms <= 2 * 3_600_000) return '1';
  if (ms <= 8 * 3_600_000) return '5';
  if (ms <= 3 * 86_400_000) return '15';
  if (ms <= 14 * 86_400_000) return '60';
  return 'D';
}

/** Snap to the minute so the query key (and the server cache key) stays stable. */
export function snapToMinute(ms: number): string {
  const d = new Date(ms);
  d.setSeconds(0, 0);
  return d.toISOString();
}

export const BAR_INTERVALS: readonly { value: BarInterval; label: string }[] = [
  { value: '1', label: '1m' },
  { value: '5', label: '5m' },
  { value: '15', label: '15m' },
  { value: '30', label: '30m' },
  { value: '60', label: '1H' },
  { value: '240', label: '4H' },
  { value: 'D', label: '1D' },
  { value: 'W', label: '1W' },
  { value: 'M', label: '1M' },
];

/** The working set an inline chart shows as segments… */
export const INTERVALS_QUICK: readonly { value: BarInterval; label: string }[] = [
  { value: '1', label: '1m' },
  { value: '5', label: '5m' },
  { value: '30', label: '30m' },
  { value: '60', label: '1H' },
  { value: 'D', label: '1D' },
];

/** …and the rest, behind the picker's chevron (see interval-picker.tsx). */
export const INTERVALS_MORE: readonly { value: BarInterval; label: string }[] = [
  { value: '15', label: '15m' },
  { value: '240', label: '4H' },
  { value: 'W', label: '1W' },
  { value: 'M', label: '1M' },
];

const ESCALATION: readonly BarInterval[] = ['1', '5', '15', '30', '60', '240', 'D'];

export interface TradeBars {
  interval: BarInterval;
  /** A manual pick also switches off the auto-escalation below. */
  pickInterval: (interval: BarInterval) => void;
  bars: MarketBar[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Candles for a window, with the interval auto-picked from its length. Short
 * trades outside market hours can come back with zero bars at the fine
 * interval, so an empty response steps up to coarser candles until something
 * renders.
 */
export function useTradeBars(params: {
  symbol: string;
  instrumentType: string;
  fromMs: number;
  toMs: number;
  /** Overrides the duration-derived default (the advanced chart picks its own). */
  initialInterval?: BarInterval;
}): TradeBars {
  const { symbol, instrumentType, fromMs, toMs, initialInterval } = params;
  const [interval, setInterval] = useState<BarInterval>(
    () => initialInterval ?? defaultInterval(fromMs, toMs),
  );

  const query = useMarketBars({
    symbol,
    instrumentType,
    interval,
    from: snapToMinute(fromMs),
    to: snapToMinute(toMs),
  });

  const raw = query.data?.bars;
  const bars = useMemo(() => raw ?? [], [raw]);

  const autoEscalate = useRef(true);
  useEffect(() => {
    if (!autoEscalate.current || !query.data || query.data.bars.length > 0) return;
    const next = ESCALATION[ESCALATION.indexOf(interval) + 1];
    if (!next) return;
    // Deferred so the escalation reads as an async reaction to the server
    // response, not a render-cascading synchronous setState.
    const timer = setTimeout(() => setInterval(next), 0);
    return () => clearTimeout(timer);
  }, [query.data, interval]);

  return {
    interval,
    pickInterval: (next) => {
      autoEscalate.current = false;
      setInterval(next);
    },
    bars,
    isLoading: query.isLoading,
    error: query.error,
  };
}
