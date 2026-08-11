import type { EquityPoint, Trade } from "./api/types";

/** Trailing window applied per-card on top of the global date filter. */
export type ChartRange = "1m" | "3m" | "6m" | "1y" | "all";

export const CHART_RANGES: { value: ChartRange; label: string }[] = [
  { value: "1m", label: "1M" },
  { value: "3m", label: "3M" },
  { value: "6m", label: "6M" },
  { value: "1y", label: "1Y" },
  { value: "all", label: "All" },
];

const RANGE_DAYS: Record<Exclude<ChartRange, "all">, number> = {
  "1m": 30,
  "3m": 91,
  "6m": 182,
  "1y": 365,
};

/** Same clock `chronologicalClosed` sorts on. */
function tradeTime(t: Trade): number {
  return new Date(t.closed_at ?? t.opened_at).getTime();
}

/**
 * Epoch-ms cutoff for a trailing range, or null for "all". Anchored at
 * `latest` — the newest visible data point, not the wall clock — so a
 * per-card range composes with the global date filter: "3M" is the last
 * three months *of the filtered window*, never an empty chart because the
 * global window ends in the past.
 */
export function chartRangeCutoff(range: ChartRange, latest: number): number | null {
  if (range === "all") return null;
  return latest - RANGE_DAYS[range] * 86_400_000;
}

export function tradesInRange(trades: Trade[], range: ChartRange): Trade[] {
  if (range === "all" || trades.length === 0) return trades;
  const latest = trades.reduce((max, t) => Math.max(max, tradeTime(t)), -Infinity);
  const cutoff = chartRangeCutoff(range, latest);
  if (cutoff == null) return trades;
  return trades.filter((t) => tradeTime(t) >= cutoff);
}

export function equityPointsInRange(points: EquityPoint[], range: ChartRange): EquityPoint[] {
  if (range === "all" || points.length === 0) return points;
  const latest = points.reduce((max, p) => Math.max(max, new Date(p.at).getTime()), -Infinity);
  const cutoff = chartRangeCutoff(range, latest);
  if (cutoff == null) return points;
  return points.filter((p) => new Date(p.at).getTime() >= cutoff);
}
