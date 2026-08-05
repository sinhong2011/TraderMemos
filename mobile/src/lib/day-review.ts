/**
 * Day-review math: the day's clock bounds, neighbour-day stepping, and the
 * cumulative realized P&L curve.
 *
 * The bounds are the mobile analog of web's `normalizeFilterDate` — a day is
 * whatever the market timezone says it is, so the API buckets the same day the
 * calendar drew (see the market-tz rule in the reports/calendar screens).
 */

import type { Trade } from '@/api/types';
import { rfc3339OffsetSuffix } from '@/lib/prefs';

/** "YYYY-MM-DD" — the shape every day key in the app uses. */
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function isDayKey(value: string | undefined): value is string {
  return value != null && DAY_KEY.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/** RFC3339 `from`/`to` covering one trading day in `timeZone`. */
export function dayBounds(date: string, timeZone: string): { from: string; to: string } {
  // Offset in effect around midday of that date (DST transitions run at night).
  const offset = rfc3339OffsetSuffix(timeZone, new Date(`${date}T12:00:00Z`));
  return { from: `${date}T00:00:00${offset}`, to: `${date}T23:59:59${offset}` };
}

/** Day key `days` steps away, noon-anchored so a DST jump can't slip the date. */
export function shiftDay(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export type CurvePoint = {
  /** RFC3339 close of the trade this step lands on. */
  at: string;
  symbol: string;
  /** Running realized P&L, already converted to the display currency. */
  cumulative: number;
};

/**
 * Cumulative realized P&L stepped at each close, oldest first — the session as
 * it actually unfolded, not the day's single net number.
 */
export function intradayCurve(trades: Trade[], fxRate = 1): CurvePoint[] {
  const closed = trades
    .filter((tr) => tr.closed_at != null && tr.net_pnl != null)
    .sort((a, b) => String(a.closed_at).localeCompare(String(b.closed_at)));
  let cumulative = 0;
  return closed.map((tr) => {
    cumulative += (tr.net_pnl ?? 0) * fxRate;
    return { at: String(tr.closed_at), symbol: tr.symbol, cumulative };
  });
}

/** Largest peak-to-trough drop of the running curve (0 when it only climbs). */
export function curveDrawdown(points: CurvePoint[]): number {
  let peak = 0;
  let worst = 0;
  for (const point of points) {
    if (point.cumulative > peak) peak = point.cumulative;
    const drop = peak - point.cumulative;
    if (drop > worst) worst = drop;
  }
  return worst;
}
