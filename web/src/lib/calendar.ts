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

/**
 * Calendar day key ("YYYY-MM-DD") for a timestamp in the given IANA zone.
 * No zone (or an invalid one) falls back to the UTC date — the legacy keying.
 */
export function dayKeyInTz(iso: string, timeZone?: string): string {
  if (!timeZone) return iso.slice(0, 10);
  try {
    // en-CA formats as YYYY-MM-DD.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

/** Calendar day key for a trade under the chosen date basis, on the trader's clock. */
export function tradeDayKey(
  trade: Pick<DatedTrade, "opened_at" | "closed_at">,
  basis: TradeDateBasis = "close",
  timeZone?: string,
): string | null {
  if (basis === "open") return dayKeyInTz(trade.opened_at, timeZone);
  if (!trade.closed_at) return null;
  return dayKeyInTz(trade.closed_at, timeZone);
}

// Derives per-day win/loss counts from closed trades, keyed "YYYY-MM-DD".
export function buildDayRecords(
  trades: { opened_at: string; closed_at: string | null; net_pnl: number | null }[],
  basis: TradeDateBasis = "close",
  timeZone?: string,
): Record<string, DayRecord> {
  const out: Record<string, DayRecord> = {};
  for (const t of trades) {
    if (t.net_pnl == null || t.net_pnl === 0) continue;
    const date = tradeDayKey(t, basis, timeZone);
    if (!date) continue;
    if (!(date in out)) out[date] = { wins: 0, losses: 0 };
    const rec = out[date];
    if (t.net_pnl > 0) rec.wins++;
    else rec.losses++;
  }
  return out;
}

/** Trades attributed to a calendar day (trader's clock) under the chosen date basis. */
export function tradesOnDay<T extends { opened_at: string; closed_at: string | null }>(
  trades: readonly T[],
  day: string,
  basis: TradeDateBasis = "close",
  timeZone?: string,
): T[] {
  return trades.filter((t) => tradeDayKey(t, basis, timeZone) === day);
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
  /** First in-month day of the row ("YYYY-MM-DD") — anchors the week-start balance. */
  firstDate: string | null;
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
      firstDate: week.find((c) => c != null)?.date ?? null,
    };
  });
}

/**
 * Account balance at a moment, read off the all-time equity curve (whose
 * points carry cash flows + realized P&L — i.e. the running balance).
 * "before" excludes points exactly at the boundary (start-of-day balances),
 * "through" includes them. No points yet → 0.
 */
export function balanceAsOf(
  points: readonly { at: string; equity: number }[],
  atISO: string,
  mode: "before" | "through" = "through",
): number {
  const cutoff = Date.parse(atISO);
  if (Number.isNaN(cutoff)) return 0;
  let balance = 0;
  let bestT = -Infinity;
  for (const p of points) {
    const t = Date.parse(p.at);
    if (Number.isNaN(t) || (mode === "before" ? t >= cutoff : t > cutoff)) continue;
    if (t >= bestT) {
      bestT = t;
      balance = p.equity;
    }
  }
  return balance;
}

export interface DayDetail {
  pnl: number;
  /** Day return on the start-of-day balance; null when nothing was funded yet. */
  pct: number | null;
  startBalance: number;
  endBalance: number;
  /** Net deposits/withdrawals dated that day. */
  deposits: number;
  /** Commissions & fees across the day's closed trades. */
  fees: number;
  trades: number;
  winRate: number | null;
  /** Gross profit / |gross loss|; Infinity when only wins, null with no trades. */
  profitFactor: number | null;
  expectancy: number | null;
}

/** At-a-glance stats for one calendar day, from data the calendar already holds. */
export function dayDetail(opts: {
  day: string;
  pnl: number;
  /** Closed trades attributed to the day (drives fees / PF / expectancy). */
  dayTrades: readonly { net_pnl: number | null; fees_total: number }[];
  record?: DayRecord;
  /** Full cash ledger for the scope. */
  cashTx: readonly { amount: number; occurred_at: string; type: string }[];
  /** All-time equity curve points for the scope. */
  equityPoints: readonly { at: string; equity: number }[];
  /** RFC3339 bounds of the day on the market clock. */
  dayStartISO: string;
  dayEndISO: string;
  timeZone?: string;
}): DayDetail {
  const startBalance = balanceAsOf(opts.equityPoints, opts.dayStartISO, "before");
  const endBalance = balanceAsOf(opts.equityPoints, opts.dayEndISO, "through");
  const deposits = opts.cashTx
    .filter(
      (c) =>
        (c.type === "deposit" || c.type === "withdrawal") &&
        dayKeyInTz(c.occurred_at, opts.timeZone) === opts.day,
    )
    .reduce((sum, c) => sum + c.amount, 0);

  let fees = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let net = 0;
  let counted = 0;
  for (const t of opts.dayTrades) {
    fees += t.fees_total;
    if (t.net_pnl == null) continue;
    counted++;
    net += t.net_pnl;
    if (t.net_pnl > 0) grossProfit += t.net_pnl;
    else grossLoss += -t.net_pnl;
  }
  const wins = opts.record?.wins ?? 0;
  const losses = opts.record?.losses ?? 0;
  const decided = wins + losses;
  return {
    pnl: opts.pnl,
    pct: startBalance > 0 ? opts.pnl / startBalance : null,
    startBalance,
    endBalance,
    deposits,
    fees,
    trades: counted,
    winRate: decided > 0 ? wins / decided : null,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : null,
    expectancy: counted > 0 ? net / counted : null,
  };
}
