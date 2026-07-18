import type { Trade } from "./api/types";
import { chronologicalClosed } from "./dashboardInsights";

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

export type EvolutionGranularity = "day" | "week" | "month";

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
  if (granularity === "month") {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
  }
  if (granularity === "week") {
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
      const pnl = t.net_pnl ?? 0;
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
