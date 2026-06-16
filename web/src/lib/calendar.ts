export interface DayCell { date: string; pnl: number | null }
export interface MonthGrid { weeks: (DayCell | null)[][]; monthTotal: number }

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
