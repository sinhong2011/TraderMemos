import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { ChartCandlestick, Maximize2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Execution } from "../../lib/api/types";
import type { MarketBar, BarInterval } from "../../lib/api/market";
import { cn } from "../../lib/cn";
import { SegmentedControl } from "../SegmentedControl";
import { Skeleton } from "../Skeleton";
import { BAR_INTERVALS, tradeChartTheme } from "./tradeChartTheme";

function toChartTime(unixSec: number): UTCTimestamp {
  return unixSec as UTCTimestamp;
}

function fillMarkers(fills: Execution[]): SeriesMarker<Time>[] {
  return fills.map((f) => ({
    time: toChartTime(Math.floor(new Date(f.executed_at).getTime() / 1000)),
    position: f.side === "buy" ? "belowBar" : "aboveBar",
    shape: f.side === "buy" ? "arrowUp" : "arrowDown",
    color: f.side === "buy" ? tradeChartTheme.buyMarker : tradeChartTheme.sellMarker,
    text: `${f.quantity} @ ${f.price}`,
  }));
}

const sectionLabelClass = "text-[10px] font-semibold uppercase tracking-widest text-signal";

export interface TradeChartProps {
  symbol: string;
  bars: MarketBar[] | undefined;
  fills: Execution[];
  loading?: boolean;
  error?: boolean;
  errorMessage?: string;
  height?: number;
  targetPrice?: number | null;
  stopPrice?: number | null;
  entryPrice?: number | null;
  interval: BarInterval;
  onIntervalChange?: (interval: BarInterval) => void;
  className?: string;
  empty?: boolean;
  /** When true, hide interval chips on empty (non-chartable symbols). */
  hideIntervalWhenEmpty?: boolean;
  /** Opens an expanded modal. Omit when already expanded. */
  onExpand?: () => void;
  /** Hide the CHART label + expand row chrome (modal embeds its own title). */
  hideHeaderLabel?: boolean;
}

export function TradeChart({
  symbol: _symbol,
  bars,
  fills,
  loading = false,
  error = false,
  errorMessage,
  height = 280,
  targetPrice,
  stopPrice,
  entryPrice,
  interval,
  onIntervalChange,
  className,
  empty = false,
  hideIntervalWhenEmpty = false,
  onExpand,
  hideHeaderLabel = false,
}: TradeChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const markersRef = useRef<ReturnType<typeof createSeriesMarkers<Time>> | null>(null);
  const [ready, setReady] = useState(false);

  const showInterval = Boolean(onIntervalChange) && !(hideIntervalWhenEmpty && empty);
  const overlayMessage = loading
    ? null
    : error
      ? (errorMessage ?? "Chart data unavailable.")
      : empty
        ? (errorMessage ?? "No chart data.")
        : bars && bars.length === 0
          ? "No bars for this window."
          : null;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      width: el.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: tradeChartTheme.background },
        textColor: tradeChartTheme.text,
        fontSize: 11,
      },
      grid: {
        vertLines: { color: tradeChartTheme.grid },
        horzLines: { color: tradeChartTheme.grid },
      },
      rightPriceScale: { borderColor: tradeChartTheme.border },
      timeScale: { borderColor: tradeChartTheme.border, timeVisible: true, secondsVisible: false },
      crosshair: { vertLine: { labelVisible: true }, horzLine: { labelVisible: true } },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: tradeChartTheme.up,
      downColor: tradeChartTheme.down,
      borderUpColor: tradeChartTheme.up,
      borderDownColor: tradeChartTheme.down,
      wickUpColor: tradeChartTheme.up,
      wickDownColor: tradeChartTheme.down,
    });

    chartRef.current = chart;
    seriesRef.current = series;
    setReady(true);

    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) chart.applyOptions({ width: w });
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      setReady(false);
    };
  }, [height]);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!ready || !series || !chart) return;

    if (!bars || bars.length === 0) {
      series.setData([]);
      return;
    }

    series.setData(
      bars.map((b) => ({
        time: toChartTime(b.time),
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      })),
    );

    for (const line of series.priceLines()) {
      series.removePriceLine(line);
    }
    if (entryPrice != null) {
      series.createPriceLine({
        price: entryPrice,
        color: tradeChartTheme.entryLine,
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: "Entry",
      });
    }
    if (targetPrice != null) {
      series.createPriceLine({
        price: targetPrice,
        color: tradeChartTheme.targetLine,
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: "Target",
      });
    }
    if (stopPrice != null) {
      series.createPriceLine({
        price: stopPrice,
        color: tradeChartTheme.stopLine,
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: "Stop",
      });
    }

    if (fills.length > 0) {
      const markers = fillMarkers(fills);
      if (markersRef.current) {
        markersRef.current.setMarkers(markers);
      } else {
        markersRef.current = createSeriesMarkers(series, markers);
      }
    } else {
      markersRef.current?.setMarkers([]);
    }

    chart.timeScale().fitContent();
  }, [ready, bars, fills, targetPrice, stopPrice, entryPrice]);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {!hideHeaderLabel && <span className={sectionLabelClass}>Chart</span>}
        <div
          className={cn("flex items-center gap-1.5", hideHeaderLabel && "w-full justify-between")}
        >
          {showInterval && (
            <SegmentedControl
              value={interval}
              onChange={(v) => onIntervalChange?.(v as BarInterval)}
              options={BAR_INTERVALS}
            />
          )}
          {onExpand && (
            <button
              type="button"
              aria-label="Expand chart"
              onClick={onExpand}
              className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-control text-text-muted transition-colors hover:bg-bg-hover hover:text-text focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
            >
              <Maximize2 size={14} strokeWidth={1.5} aria-hidden />
            </button>
          )}
        </div>
      </div>
      <div className="relative overflow-hidden rounded-sharp bg-bg-inset" style={{ height }}>
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg-inset/80">
            <Skeleton height={`${height - 24}px`} className="mx-3 w-[calc(100%-1.5rem)]" />
          </div>
        )}
        {!loading && overlayMessage && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-4">
            <div className="flex flex-col items-center gap-2 rounded-sharp bg-bg-inset px-4 py-8">
              <ChartCandlestick
                size={18}
                strokeWidth={1.5}
                className="text-text-dim"
                role="img"
                aria-label="No chart data"
              />
              <p className="m-0 text-center text-xs text-text-muted">{overlayMessage}</p>
            </div>
          </div>
        )}
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  );
}
