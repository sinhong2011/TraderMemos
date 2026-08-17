/**
 * Client-side reports analytics, ported verbatim from
 * web/src/lib/reportsAnalytics.ts — keep the two in sync.
 */

import type { EquityPoint, Trade } from '@/api/types';
import { chronologicalClosed } from '@/lib/insights';

export interface RollingWinRatePoint {
  index: number;
  rate: number;
}

/** Win rate over a trailing window of N chronological closed trades. One point per trade once the window fills. */
export function rollingWinRate(trades: Trade[], windowSize: number): RollingWinRatePoint[] {
  const closed = chronologicalClosed(trades);
  if (closed.length < windowSize) return [];
  const points: RollingWinRatePoint[] = [];
  for (let i = windowSize - 1; i < closed.length; i++) {
    let wins = 0;
    for (let j = i - windowSize + 1; j <= i; j++) {
      if ((closed[j].net_pnl ?? 0) > 0) wins += 1;
    }
    points.push({ index: i + 1, rate: wins / windowSize });
  }
  return points;
}

export type EvolutionGranularity = 'day' | 'week' | 'month';

export interface EvolutionPoint {
  bucket: string;
  winRate: number;
  cumulativePnl: number;
  profitFactor: number;
  expectancy: number;
  avgPnlPerTrade: number;
}

function bucketKey(iso: string, granularity: EvolutionGranularity): string {
  const d = new Date(iso);
  if (granularity === 'month') {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
  }
  if (granularity === 'week') {
    const dayOfWeek = d.getUTCDay();
    const diffFromMonday = (dayOfWeek + 6) % 7;
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - diffFromMonday);
    return monday.toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Cumulative-to-date metrics, one point per period, so trends plateau as
 * history accumulates. `expectancy` uses the same formula as the backend's
 * `Summary.expectancy` (winRate*avgWin - lossRate*avgLoss); `avgPnlPerTrade`
 * is a plain average, so the two lines are related but not identical.
 */
export function metricEvolution(
  trades: Trade[],
  granularity: EvolutionGranularity,
  tradePnl: (t: Trade) => number = (t) => t.net_pnl ?? 0,
): EvolutionPoint[] {
  const closed = chronologicalClosed(trades);
  if (closed.length === 0) return [];

  const byBucket = new Map<string, Trade[]>();
  for (const t of closed) {
    const key = bucketKey(t.closed_at ?? t.opened_at, granularity);
    const list = byBucket.get(key);
    if (list) list.push(t);
    else byBucket.set(key, [t]);
  }
  const buckets = [...byBucket.keys()].sort();

  let wins = 0;
  let losses = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let cumulativePnl = 0;
  let count = 0;
  const points: EvolutionPoint[] = [];

  for (const bucket of buckets) {
    const bucketTrades = byBucket.get(bucket);
    if (!bucketTrades) continue;
    for (const t of bucketTrades) {
      const pnl = tradePnl(t);
      cumulativePnl += pnl;
      count += 1;
      if (pnl > 0) {
        wins += 1;
        grossProfit += pnl;
      } else if (pnl < 0) {
        losses += 1;
        grossLoss += -pnl;
      }
    }
    const winRate = count > 0 ? wins / count : 0;
    const avgWin = wins > 0 ? grossProfit / wins : 0;
    const avgLoss = losses > 0 ? grossLoss / losses : 0;
    const lossRate = count > 0 ? losses / count : 0;
    points.push({
      bucket,
      winRate,
      cumulativePnl: Math.round(cumulativePnl * 100) / 100,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : 0,
      expectancy: Math.round((winRate * avgWin - lossRate * avgLoss) * 100) / 100,
      avgPnlPerTrade: Math.round((cumulativePnl / count) * 100) / 100,
    });
  }
  return points;
}

export interface DrawdownPoint {
  at: string;
  drawdownPct: number;
}

/** Running peak vs. each equity point, as a fraction (negative or zero). */
export function drawdownSeries(points: EquityPoint[]): DrawdownPoint[] {
  let peak = -Infinity;
  return points.map((p) => {
    if (p.equity > peak) peak = p.equity;
    const drawdownPct = peak > 0 ? (p.equity - peak) / peak : 0;
    return { at: p.at, drawdownPct };
  });
}

export interface DrawdownDepthPoint {
  at: string;
  /** Dollars below the running peak — 0 at a new high, negative in a trough. */
  depth: number;
}

/**
 * Depth below the running equity peak in account currency. Percent-of-peak
 * (`drawdownPct`, web's measure) breaks on range-scoped curves: the running
 * peak starts near zero, so an ordinary dollar dip early in the window reads
 * as "-250%". Money is stable whatever the window; the reports unit toggle
 * supplies a percentage with a real base (net deposits) when wanted.
 */
export function drawdownDepthSeries(points: EquityPoint[]): DrawdownDepthPoint[] {
  let peak = -Infinity;
  return points.map((p) => {
    if (p.equity > peak) peak = p.equity;
    return { at: p.at, depth: p.equity - peak };
  });
}

export function currentDrawdownPct(points: EquityPoint[]): number {
  const series = drawdownSeries(points);
  return series.length > 0 ? series[series.length - 1].drawdownPct : 0;
}

export function maxDrawdownPct(points: EquityPoint[]): number {
  const series = drawdownSeries(points);
  return series.reduce((min, p) => Math.min(min, p.drawdownPct), 0);
}

export interface AvgRiskPerTrade {
  avg: number | null;
  included: number;
  excluded: number;
}

/** Average planned risk ($) across trades with a stop set (`initial_risk`). */
export function avgRiskPerTrade(trades: Trade[]): AvgRiskPerTrade {
  const withRisk = trades.filter((t) => t.initial_risk != null && t.initial_risk > 0);
  const excluded = trades.length - withRisk.length;
  if (withRisk.length === 0) return { avg: null, included: 0, excluded };
  const sum = withRisk.reduce((acc, t) => acc + (t.initial_risk ?? 0), 0);
  return {
    avg: Math.round((sum / withRisk.length) * 100) / 100,
    included: withRisk.length,
    excluded,
  };
}
