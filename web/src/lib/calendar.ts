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

// Derives per-day win/loss counts from closed trades, keyed "YYYY-MM-DD".
export function buildDayRecords(
  trades: { closed_at: string | null; net_pnl: number | null }[],
): Record<string, DayRecord> {
  const out: Record<string, DayRecord> = {};
  for (const t of trades) {
    if (!t.closed_at || t.net_pnl == null || t.net_pnl === 0) continue;
    const date = t.closed_at.slice(0, 10);
    if (!(date in out)) out[date] = { wins: 0, losses: 0 };
    const rec = out[date];
    if (t.net_pnl > 0) rec.wins++;
    else rec.losses++;
  }
  return out;
}

export interface WeekSummary {
  pnl: number;
  wins: number;
  losses: number;
  hasData: boolean;
}

// One summary per grid row: summed P&L and win/loss record for the week.
export function weekSummaries(
  weeks: (DayCell | null)[][],
  records: Record<string, DayRecord>,
): WeekSummary[] {
  return weeks.map((week) => {
    let pnl = 0;
    let wins = 0;
    let losses = 0;
    let hasData = false;
    for (const cell of week) {
      if (!cell) continue;
      if (cell.pnl != null) {
        pnl += cell.pnl;
        hasData = true;
      }
      const rec = records[cell.date];
      if (rec) {
        wins += rec.wins;
        losses += rec.losses;
      }
    }
    return { pnl: Math.round(pnl * 100) / 100, wins, losses, hasData };
  });
}
