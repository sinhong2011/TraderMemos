import type { Trade } from "./api/types";
import { fmtTradeDay } from "./format";
import { chronologicalClosed, computeHomeInsights, type DayPnl } from "./homeInsights";

export const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export interface WrappedMonth {
  /** 0-11 */
  month: number;
  label: string;
  trades: number;
  pnl: number;
}

export interface WrappedSymbol {
  symbol: string;
  trades: number;
  pnl: number;
}

export interface WrappedTrade {
  symbol: string;
  pnl: number;
  /** ISO date (YYYY-MM-DD) of the close. */
  date: string;
}

export interface YearWrapped {
  year: number;
  totalTrades: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number;
  netPnl: number;
  grossProfit: number;
  grossLoss: number;
  /** 0 when there are no losses. */
  profitFactor: number;
  expectancy: number;
  totalFees: number;
  biggestWin: WrappedTrade | null;
  biggestLoss: WrappedTrade | null;
  bestDay: DayPnl | null;
  worstDay: DayPnl | null;
  bestStreak: number;
  worstStreak: number;
  /** Top symbols by trade count (max 3). */
  topSymbols: WrappedSymbol[];
  /** All 12 months, in order. */
  months: WrappedMonth[];
  busiestMonth: WrappedMonth | null;
  /** Distinct days traded, and how many closed green / red. */
  tradingDays: number;
  greenDays: number;
  redDays: number;
  totalHoldSecs: number;
  avgHoldSecs: number | null;
  mainMistake: string | null;
}

/** Market-timezone trading day of the trade's close (fallback open). */
function isoDay(t: Trade): string {
  return fmtTradeDay(t.closed_at ?? t.opened_at);
}

/**
 * Compute the annual recap from a year's trades (closed trades only).
 * Trades outside `year` (by close date) are ignored defensively.
 */
export function computeYearWrapped(trades: Trade[], year: number): YearWrapped {
  const inYear = trades.filter((t) => isoDay(t).startsWith(`${year}-`));
  const closed = chronologicalClosed(inYear);
  const insights = computeHomeInsights(inYear);

  let wins = 0;
  let losses = 0;
  let breakeven = 0;
  let netPnl = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let totalFees = 0;
  let totalHoldSecs = 0;
  let holds = 0;
  let biggestWin: WrappedTrade | null = null;
  let biggestLoss: WrappedTrade | null = null;

  const months: WrappedMonth[] = MONTH_LABELS.map((label, month) => ({
    month,
    label,
    trades: 0,
    pnl: 0,
  }));
  const bySymbol = new Map<string, { trades: number; pnl: number }>();
  const byDay = new Map<string, number>();

  for (const t of closed) {
    const pnl = t.net_pnl ?? 0;
    netPnl += pnl;
    totalFees += t.fees_total ?? 0;
    if (pnl > 0) {
      wins += 1;
      grossProfit += pnl;
      if (!biggestWin || pnl > biggestWin.pnl) {
        biggestWin = { symbol: t.symbol, pnl, date: isoDay(t) };
      }
    } else if (pnl < 0) {
      losses += 1;
      grossLoss += -pnl;
      if (!biggestLoss || pnl < biggestLoss.pnl) {
        biggestLoss = { symbol: t.symbol, pnl, date: isoDay(t) };
      }
    } else {
      breakeven += 1;
    }

    if (t.time_in_trade_secs != null && t.time_in_trade_secs > 0) {
      totalHoldSecs += t.time_in_trade_secs;
      holds += 1;
    }

    const day = isoDay(t);
    byDay.set(day, (byDay.get(day) ?? 0) + pnl);
    const month = Number(day.slice(5, 7)) - 1;
    if (month >= 0 && month < 12) {
      months[month].trades += 1;
      months[month].pnl += pnl;
    }

    const sym = bySymbol.get(t.symbol) ?? { trades: 0, pnl: 0 };
    sym.trades += 1;
    sym.pnl += pnl;
    bySymbol.set(t.symbol, sym);
  }

  const totalTrades = closed.length;
  const winRate = totalTrades > 0 ? wins / totalTrades : 0;
  const avgWin = wins > 0 ? grossProfit / wins : 0;
  const avgLoss = losses > 0 ? grossLoss / losses : 0;
  const lossRate = totalTrades > 0 ? losses / totalTrades : 0;

  let greenDays = 0;
  let redDays = 0;
  for (const pnl of byDay.values()) {
    if (pnl > 0) greenDays += 1;
    else if (pnl < 0) redDays += 1;
  }

  const busiestMonth = months.reduce<WrappedMonth | null>(
    (acc, m) => (m.trades > 0 && (!acc || m.trades > acc.trades) ? m : acc),
    null,
  );

  const topSymbols: WrappedSymbol[] = [...bySymbol.entries()]
    .map(([symbol, s]) => ({ symbol, trades: s.trades, pnl: s.pnl }))
    .sort((a, b) => b.trades - a.trades || b.pnl - a.pnl)
    .slice(0, 3);

  return {
    year,
    totalTrades,
    wins,
    losses,
    breakeven,
    winRate,
    netPnl,
    grossProfit,
    grossLoss,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : 0,
    expectancy: winRate * avgWin - lossRate * avgLoss,
    totalFees,
    biggestWin,
    biggestLoss,
    bestDay: insights.bestDay,
    worstDay: insights.worstDay,
    bestStreak: insights.bestStreak,
    worstStreak: insights.worstStreak,
    topSymbols,
    months,
    busiestMonth,
    tradingDays: byDay.size,
    greenDays,
    redDays,
    totalHoldSecs,
    avgHoldSecs: holds > 0 ? totalHoldSecs / holds : null,
    mainMistake: insights.mainMistake,
  };
}
