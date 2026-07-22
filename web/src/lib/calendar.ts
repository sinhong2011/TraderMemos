import type { TradeDateBasis } from "./displayPrefs";

export interface DayCell {
  date: string;
  pnl: number | null;
}
export interface MonthGrid {
  weeks: (DayCell | null)[][];
  monthTotal: number;
}

// month is 1-based. Builds a fixed 6-row grid (Sun-first) with daily P&L.
export function monthGrid(year: number, month: number, pnl: Record<string, number>): MonthGrid {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const startDow = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (DayCell | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  let monthTotal = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const v = pnl[date] ?? null;
    if (v != null) monthTotal += v;
    cells.push({ date, pnl: v });
  }
  while (cells.length < 42) cells.push(null);
  const weeks: (DayCell | null)[][] = [];
  for (let i = 0; i < 42; i += 7) weeks.push(cells.slice(i, i + 7));
  return { weeks, monthTotal: Math.round(monthTotal * 100) / 100 };
}

export interface DayRecord {
  wins: number;
  losses: number;
}

type DatedTrade = {
  opened_at: string;
  closed_at: string | null;
  net_pnl?: number | null;
};

/** UTC calendar day key for a trade under the chosen date basis. */
export function tradeDayKey(
  trade: Pick<DatedTrade, "opened_at" | "closed_at">,
  basis: TradeDateBasis = "close",
): string | null {
  if (basis === "open") return trade.opened_at.slice(0, 10);
  if (!trade.closed_at) return null;
  return trade.closed_at.slice(0, 10);
}

// Derives per-day win/loss counts from closed trades, keyed "YYYY-MM-DD".
export function buildDayRecords(
  trades: { opened_at: string; closed_at: string | null; net_pnl: number | null }[],
  basis: TradeDateBasis = "close",
): Record<string, DayRecord> {
  const out: Record<string, DayRecord> = {};
  for (const t of trades) {
    if (t.net_pnl == null || t.net_pnl === 0) continue;
    const date = tradeDayKey(t, basis);
    if (!date) continue;
    if (!(date in out)) out[date] = { wins: 0, losses: 0 };
    const rec = out[date];
    if (t.net_pnl > 0) rec.wins++;
    else rec.losses++;
  }
  return out;
}

/** Trades attributed to a UTC calendar day under the chosen date basis. */
export function tradesOnDay<T extends { opened_at: string; closed_at: string | null }>(
  trades: readonly T[],
  day: string,
  basis: TradeDateBasis = "close",
): T[] {
  return trades.filter((t) => tradeDayKey(t, basis) === day);
}

export interface WeekSummary {
  pnl: number;
  wins: number;
  losses: number;
  hasData: boolean;
  /** 1-based week-of-month index among non-empty month rows. */
  weekNumber: number | null;
  /** Count of calendar days in the row that have P&L. */
  daysWithTrades: number;
}

// One summary per grid row: summed P&L and win/loss record for the week.
export function weekSummaries(
  weeks: (DayCell | null)[][],
  records: Record<string, DayRecord>,
): WeekSummary[] {
  let monthWeek = 0;
  return weeks.map((week) => {
    const inMonth = week.some((c) => c != null);
    const weekNumber = inMonth ? ++monthWeek : null;
    let pnl = 0;
    let wins = 0;
    let losses = 0;
    let hasData = false;
    let daysWithTrades = 0;
    for (const cell of week) {
      if (!cell) continue;
      if (cell.pnl != null) {
        pnl += cell.pnl;
        hasData = true;
        daysWithTrades += 1;
      }
      const rec = records[cell.date];
      if (rec) {
        wins += rec.wins;
        losses += rec.losses;
      }
    }
    return {
      pnl: Math.round(pnl * 100) / 100,
      wins,
      losses,
      hasData,
      weekNumber,
      daysWithTrades,
    };
  });
}
