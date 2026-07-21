import type { CandlestickData, UTCTimestamp, WhitespaceData } from "lightweight-charts";
import type { BarInterval, MarketBar } from "../../lib/api/market";
import { CHART_TIME_ZONE, utcSecToChartTime } from "./chartTime";

const INTERVAL_SEC: Record<BarInterval, number> = {
  "1": 60,
  "5": 300,
  "15": 900,
  "60": 3600,
  "240": 14_400,
  D: 86_400,
};

/** Cap how many missing bars we materialize so weekends/holidays stay compact. */
function maxGapFill(interval: BarInterval): number {
  return interval === "D" ? 5 : 96;
}

export type ChartCandlePoint = CandlestickData<UTCTimestamp> | WhitespaceData<UTCTimestamp>;

/**
 * Map market bars to lightweight-charts candlestick data, inserting whitespace
 * for missing intervals so the time axis matches candle spacing.
 *
 * LWC plots points by index, not wall-clock duration — without whitespace,
 * skipped Yahoo nulls look continuous while labels jump. Times are shifted to
 * {@link CHART_TIME_ZONE} because LWC labels UTCTimestamps as UTC wall-clock.
 */
export function barsToCandlestickData(
  bars: MarketBar[],
  interval: BarInterval,
  timeZone: string = CHART_TIME_ZONE,
): ChartCandlePoint[] {
  if (bars.length === 0) return [];

  const step = INTERVAL_SEC[interval];
  const maxFill = maxGapFill(interval);
  const out: ChartCandlePoint[] = [];
  const toTime = (utcSec: number) => utcSecToChartTime(utcSec, timeZone);

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i]!;
    if (i > 0) {
      const prevTime = bars[i - 1]!.time;
      const gap = bar.time - prevTime;
      if (gap > step * 1.5) {
        const missing = Math.floor(gap / step) - 1;
        if (missing > 0 && missing <= maxFill) {
          for (let t = prevTime + step; t < bar.time - step * 0.25; t += step) {
            out.push({ time: toTime(t) });
          }
        } else if (missing > maxFill) {
          // Session / multi-day break: a few slots so candles don't look glued.
          for (let k = 1; k <= 3; k++) {
            out.push({ time: toTime(prevTime + Math.floor((gap * k) / 4)) });
          }
        }
      }
    }
    out.push({
      time: toTime(bar.time),
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    });
  }

  return out;
}
