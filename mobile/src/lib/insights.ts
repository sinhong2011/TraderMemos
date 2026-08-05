/**
 * Client-side dashboard insights derived from the trade list, ported from
 * web/src/lib/dashboardInsights.ts (streaks, best/worst day, holds, leaks).
 */

import type { Trade } from '@/api/types';

export interface DayPnl {
  /** "YYYY-MM-DD" */
  date: string;
  pnl: number;
}

export interface DashboardInsights {
  bestStreak: number;
  worstStreak: number;
  bestDay: DayPnl | null;
  worstDay: DayPnl | null;
  avgHoldSecs: number | null;
  /** Closed trades that actually carried a hold time — the avg's sample size. */
  holdCount: number;
  winHoldSecs: number | null;
  lossHoldSecs: number | null;
  mainMistake: string | null;
  topSymbol: string | null;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Closed trades only, oldest → newest by close (fallback open). */
export function chronologicalClosed(trades: Trade[]): Trade[] {
  return trades
    .filter((t) => t.status !== 'open' && t.net_pnl != null)
    .slice()
    .sort((a, b) => {
      const aAt = a.closed_at ?? a.opened_at;
      const bAt = b.closed_at ?? b.opened_at;
      return new Date(aAt).getTime() - new Date(bAt).getTime();
    });
}

function streaks(closed: Trade[]): { best: number; worst: number } {
  let best = 0;
  let worst = 0;
  let curWin = 0;
  let curLoss = 0;
  for (const t of closed) {
    const pnl = t.net_pnl ?? 0;
    if (pnl > 0) {
      curWin += 1;
      curLoss = 0;
      if (curWin > best) best = curWin;
    } else if (pnl < 0) {
      curLoss += 1;
      curWin = 0;
      if (curLoss > worst) worst = curLoss;
    } else {
      curWin = 0;
      curLoss = 0;
    }
  }
  return { best, worst };
}

function dayPnls(closed: Trade[]): DayPnl[] {
  const map = new Map<string, number>();
  for (const t of closed) {
    const key = (t.closed_at ?? t.opened_at).slice(0, 10);
    map.set(key, (map.get(key) ?? 0) + (t.net_pnl ?? 0));
  }
  return [...map.entries()].map(([date, pnl]) => ({ date, pnl }));
}

function mostFrequent(names: string[]): string | null {
  if (names.length === 0) return null;
  const counts = new Map<string, number>();
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
  let best: string | null = null;
  let bestN = 0;
  for (const [name, n] of counts) {
    if (n > bestN) {
      best = name;
      bestN = n;
    }
  }
  return best;
}

export function computeDashboardInsights(trades: Trade[]): DashboardInsights {
  const closed = chronologicalClosed(trades);
  const { best, worst } = streaks(closed);
  const days = dayPnls(closed);
  const bestDay = days.reduce<DayPnl | null>((acc, d) => (!acc || d.pnl > acc.pnl ? d : acc), null);
  const worstDay = days.reduce<DayPnl | null>(
    (acc, d) => (!acc || d.pnl < acc.pnl ? d : acc),
    null,
  );

  const holds = closed
    .map((t) => t.time_in_trade_secs)
    .filter((s): s is number => s != null && s > 0);
  const winHolds = closed
    .filter((t) => (t.net_pnl ?? 0) > 0)
    .map((t) => t.time_in_trade_secs)
    .filter((s): s is number => s != null && s > 0);
  const lossHolds = closed
    .filter((t) => (t.net_pnl ?? 0) < 0)
    .map((t) => t.time_in_trade_secs)
    .filter((s): s is number => s != null && s > 0);

  const mistakes = closed.flatMap((t) =>
    t.tags.filter((tag) => tag.kind === 'mistake').map((tag) => tag.name),
  );
  const symbols = closed.map((t) => t.symbol);

  return {
    bestStreak: best,
    worstStreak: worst,
    bestDay,
    worstDay,
    avgHoldSecs: mean(holds),
    holdCount: holds.length,
    winHoldSecs: mean(winHolds),
    lossHoldSecs: mean(lossHolds),
    mainMistake: mostFrequent(mistakes),
    topSymbol: mostFrequent(symbols),
  };
}
