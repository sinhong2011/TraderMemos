import type { Trade } from "./api/types";

export interface HeatmapCell {
  pnl: number;
  trades: number;
  /** Closed trades bucketed into this cell, in input order. */
  items: Trade[];
}

export interface PnlHeatmap {
  /** 7 rows (0=Mon … 6=Sun) × 24 hour columns, indexed [day][hour]. */
  grid: HeatmapCell[][];
  /** Day rows that have at least one trade, ascending (Mon first). */
  days: number[];
  /** Inclusive hour column range covering every traded hour. */
  hourStart: number;
  hourEnd: number;
  maxAbsPnl: number;
  /** Closed trades counted into the grid. */
  total: number;
}

export const HEATMAP_DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const DAY_INDEX: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

/**
 * Bucket closed trades by entry weekday × hour in the market timezone —
 * grouping stays on the market clock like the rest of the app; the display
 * timezone only ever formats. Hours outside the traded range are trimmed by
 * the returned [hourStart, hourEnd] so quiet sessions don't flatten the grid.
 * `pnlOf` defaults to net_pnl; Reports passes a net/gross-aware accessor.
 */
export function computePnlHeatmap(
  trades: Trade[],
  timeZone: string,
  pnlOf: (t: Trade) => number = (t) => t.net_pnl ?? 0,
): PnlHeatmap {
  const grid: HeatmapCell[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => ({ pnl: 0, trades: 0, items: [] as Trade[] })),
  );
  // Two dedicated formatters instead of one formatToParts pass: Hermes (the
  // mobile port shares this file) tags the weekday part as "literal", so part
  // types can't be trusted across engines — plain format() output can.
  const dayFmt = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" });
  const hourFmt = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hour12: false });

  let total = 0;
  for (const t of trades) {
    if (t.status !== "closed" || t.net_pnl == null) continue;
    const opened = new Date(t.opened_at);
    const day = DAY_INDEX[dayFmt.format(opened)];
    const rawHour = Number(hourFmt.format(opened));
    if (day == null || !Number.isFinite(rawHour)) continue;
    // Some engines report midnight as "24" with hour12: false.
    const hour = rawHour % 24;
    const cell = grid[day][hour];
    cell.pnl += pnlOf(t);
    cell.trades += 1;
    cell.items.push(t);
    total += 1;
  }

  const days: number[] = [];
  let hourStart = 24;
  let hourEnd = -1;
  let maxAbsPnl = 0;
  for (let d = 0; d < 7; d++) {
    let dayHasTrades = false;
    for (let h = 0; h < 24; h++) {
      const cell = grid[d][h];
      if (cell.trades === 0) continue;
      dayHasTrades = true;
      hourStart = Math.min(hourStart, h);
      hourEnd = Math.max(hourEnd, h);
      maxAbsPnl = Math.max(maxAbsPnl, Math.abs(cell.pnl));
    }
    if (dayHasTrades) days.push(d);
  }

  // Default to the US cash session when there is nothing to show yet.
  if (hourEnd < 0) {
    hourStart = 9;
    hourEnd = 16;
  }

  return { grid, days, hourStart, hourEnd, maxAbsPnl, total };
}
