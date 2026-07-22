import { TZDate } from "@date-fns/tz";
import type { UTCTimestamp } from "lightweight-charts";

/**
 * US equity session clock — matches api/internal/analytics/session.go.
 * Lightweight Charts has no timezone support; it labels UTCTimestamps as UTC
 * wall-clock, so we shift unix times so the displayed clock is Eastern.
 */
export const CHART_TIME_ZONE = "America/New_York";

/**
 * Convert a real UTC unix second to a lightweight-charts UTCTimestamp whose
 * UTC clock face equals local wall time in `timeZone`.
 *
 * @see https://tradingview.github.io/lightweight-charts/docs/time-zones
 */
export function utcSecToChartTime(
  utcSec: number,
  timeZone: string = CHART_TIME_ZONE,
): UTCTimestamp {
  const zoned = new TZDate(utcSec * 1000, timeZone);
  return (Date.UTC(
    zoned.getFullYear(),
    zoned.getMonth(),
    zoned.getDate(),
    zoned.getHours(),
    zoned.getMinutes(),
    zoned.getSeconds(),
  ) / 1000) as UTCTimestamp;
}
