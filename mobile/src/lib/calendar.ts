/** Month-grid math for the dashboard mini calendar, ported from web/src/lib/calendar.ts. */

export interface DayCell {
  /** "YYYY-MM-DD" */
  date: string;
  pnl: number | null;
}

export interface MonthGrid {
  weeks: (DayCell | null)[][];
  monthTotal: number;
  /** Largest |daily P&L| in the month — drives heatmap tint intensity. */
  maxAbs: number;
}

/** month is 1-based. Builds a Sun-first grid of full weeks with daily P&L. */
export function monthGrid(year: number, month: number, pnl: Record<string, number>): MonthGrid {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const startDow = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (DayCell | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  let monthTotal = 0;
  let maxAbs = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const v = pnl[date] ?? null;
    if (v != null) {
      monthTotal += v;
      if (Math.abs(v) > maxAbs) maxAbs = Math.abs(v);
    }
    cells.push({ date, pnl: v });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (DayCell | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return { weeks, monthTotal: Math.round(monthTotal * 100) / 100, maxAbs };
}
