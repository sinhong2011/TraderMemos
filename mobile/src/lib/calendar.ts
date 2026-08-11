/** Month-grid math for the dashboard mini calendar, ported from web/src/lib/calendar.ts. */

/** Latest equity on the curve at or before `atISO` ("before" excludes boundary points). */
export function balanceAsOf(
  points: readonly { at: string; equity: number }[],
  atISO: string,
  mode: 'before' | 'through' = 'through',
): number {
  const cutoff = Date.parse(atISO);
  if (Number.isNaN(cutoff)) return 0;
  let balance = 0;
  let bestT = -Infinity;
  for (const p of points) {
    const t = Date.parse(p.at);
    if (Number.isNaN(t) || (mode === 'before' ? t >= cutoff : t > cutoff)) continue;
    if (t >= bestT) {
      bestT = t;
      balance = p.equity;
    }
  }
  return balance;
}

/** Balance walking into a period — equity curve when available, else net deposits. */
export function periodStartBalance(
  equityPoints: readonly { at: string; equity: number }[],
  startISO: string,
  deposits: number,
): number | null {
  const balance = equityPoints.length
    ? balanceAsOf(equityPoints, startISO, 'before')
    : deposits;
  return balance > 0 ? balance : null;
}

export interface DayCell {
  /** "YYYY-MM-DD" */
  date: string;
  pnl: number | null;
}

/** Whether a day had trading activity — weekend columns/rows hide when this is false. */
export function dayHasTradingActivity(
  pnl: number | null | undefined,
  tradeCount: number,
): boolean {
  return pnl != null || tradeCount > 0;
}

/** Month grid: show weekend columns when any week in the month traded on a weekend day. */
export function monthWeekendColumnsVisible(
  weeks: (DayCell | null)[][],
  dayStats: ReadonlyMap<string, { count: number }>,
): boolean {
  return weeks.some((w) =>
    [w[0], w[6]].some(
      (c) => c && dayHasTradingActivity(c.pnl, dayStats.get(c.date)?.count ?? 0),
    ),
  );
}

/** Week mode: drop Sun/Sat when they have no activity; weekdays always stay. */
export function weekVisibleDayKeys(
  weekKeys: string[],
  pnl: Record<string, number>,
  dayStats: ReadonlyMap<string, { count: number }>,
): string[] {
  return weekKeys.filter((key, i) => {
    if (i !== 0 && i !== 6) return true;
    return dayHasTradingActivity(pnl[key], dayStats.get(key)?.count ?? 0);
  });
}

export interface MonthGrid {
  weeks: (DayCell | null)[][];
  monthTotal: number;
  /** Largest |daily P&L| in the month — drives heatmap tint intensity. */
  maxAbs: number;
}

/** UTC day key ("YYYY-MM-DD") a closed trade lands on — close basis, like web. */
export function tradeDayKey(trade: { closed_at: string | null }): string | null {
  return trade.closed_at ? trade.closed_at.slice(0, 10) : null;
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
