import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TradeDetail } from "@/lib/api/types";
import { usePrivacyMode } from "@/lib/displayPrefs";
import { fmtMoneyCompact, fmtSignedMoney, fmtSignedMoneyCompact } from "@/lib/format";
import { chartWindowFromTrade, defaultBarInterval, useMarketBars } from "@/lib/hooks/useMarketBars";
import { intlLocale } from "@/lib/locale";
import { chartTheme, chartTooltipStyle, pnlTooltipValue } from "./ChartFrame";
import { computeExcursionSeries, trimBarsToHold } from "./charts/excursionSeries";
import { formatReplayBarTime } from "./charts/replayPnl";
import { Skeleton } from "./Skeleton";

/**
 * Dashed reference line label rendered as a value pill hugging the right edge,
 * so "MFE +$420" reads at the level it marks instead of in a distant legend.
 */
function refPill(text: string, color: string) {
  return function Pill(props: { viewBox?: { x?: number; y?: number; width?: number } }) {
    const { x = 0, y = 0, width = 0 } = props.viewBox ?? {};
    const w = Math.round(text.length * 5.8) + 14;
    return (
      <g>
        <rect
          x={x + width - w}
          y={y - 8}
          width={w}
          height={16}
          rx={8}
          fill="var(--popover)"
          stroke="var(--border)"
        />
        <text
          x={x + width - w / 2}
          y={y}
          dy={3.5}
          textAnchor="middle"
          fontSize={10}
          fontWeight={600}
          fill={color}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {text}
        </text>
      </g>
    );
  };
}

/** Round away from zero to a half-magnitude step so axis bounds land on round money. */
function niceBound(v: number): number {
  if (v === 0) return 0;
  const step = 10 ** Math.floor(Math.log10(Math.abs(v))) / 2;
  return Math.sign(v) * Math.ceil(Math.abs(v) / step) * step;
}

export interface TradeExcursionChartProps {
  trade: TradeDetail;
}

/**
 * Intra-trade excursion chart: gross open equity across the holding window,
 * profit-colored above breakeven / loss-colored below, with dashed MFE / MAE
 * reference lines and entry / exit markers. Renders nothing when bars for the
 * window aren't available — the numeric excursion grid stays the fallback.
 */
export function TradeExcursionChart({ trade }: TradeExcursionChartProps) {
  usePrivacyMode();
  const locale = intlLocale();
  const currency = trade.pnl_currency;

  const eligible =
    trade.status === "closed" && trade.instrument_type !== "option" && trade.closed_at != null;
  const window = eligible ? chartWindowFromTrade(trade.opened_at, trade.closed_at) : null;
  const interval = defaultBarInterval(window?.from, window?.to);

  const barsQ = useMarketBars({
    symbol: trade.symbol,
    instrument_type: trade.instrument_type,
    from: window?.from,
    to: window?.to,
    interval,
    enabled: eligible,
  });

  const bars = barsQ.data?.bars;
  const fills = trade.fills;
  const openedAt = trade.opened_at;
  const closedAt = trade.closed_at;
  const series = useMemo(() => {
    if (!bars || bars.length === 0 || closedAt == null) return null;
    return computeExcursionSeries(
      fills,
      trimBarsToHold(bars, interval, openedAt, closedAt),
      interval,
    );
  }, [fills, bars, interval, openedAt, closedAt]);

  if (!eligible || barsQ.isError) return null;
  if (barsQ.isLoading) return <Skeleton height="176px" />;
  if (!series || series.points.length < 2) return null;

  // Reference lines mark the stored (server-computed) MAE/MFE when present so
  // they agree with the stat cells below; the local envelope fills in before
  // an auto-fill has run.
  const mfe = trade.mfe ?? series.mfe;
  const mae = trade.mae ?? series.mae;

  const values = series.points.map((p) => p.equity);
  const lo = Math.min(0, -mae, ...values);
  const hi = Math.max(0, mfe, ...values);
  const pad = Math.max((hi - lo) * 0.12, 1e-9);
  const min = lo === 0 ? 0 : niceBound(lo - pad);
  const max = hi === 0 ? 0 : niceBound(hi + pad);
  // Halfway steps read fine in compact notation; zero anchors the baseline.
  const ticks = [...new Set([min, min / 2, 0, max / 2, max])].sort((a, b) => a - b);
  // Zero-crossing offset for the split gradient: profit above, loss below.
  const zero = max <= 0 ? 0 : min >= 0 ? 1 : max / (max - min);

  const first = series.points[0]!;
  const last = series.points[series.points.length - 1]!;

  return (
    <ResponsiveContainer width="100%" height={176}>
      <AreaChart data={series.points} margin={{ top: 10, right: 8, bottom: 0, left: 4 }}>
        <defs>
          <linearGradient id="excursion-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset={0} stopColor="var(--profit)" stopOpacity={0.25} />
            <stop offset={zero} stopColor="var(--profit)" stopOpacity={0.03} />
            <stop offset={zero} stopColor="var(--loss)" stopOpacity={0.03} />
            <stop offset={1} stopColor="var(--loss)" stopOpacity={0.25} />
          </linearGradient>
          <linearGradient id="excursion-stroke" x1="0" y1="0" x2="0" y2="1">
            <stop offset={zero} stopColor="var(--profit)" />
            <stop offset={zero} stopColor="var(--loss)" />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={chartTheme.gridColor} />
        <XAxis
          dataKey="time"
          tickFormatter={(v: number) => formatReplayBarTime(v, interval, locale)}
          tick={{ fontSize: 10, fill: chartTheme.axisColor }}
          axisLine={false}
          tickLine={false}
          minTickGap={56}
        />
        <YAxis
          domain={[min, max]}
          ticks={ticks}
          tickFormatter={(v: number) => fmtMoneyCompact(v, currency, locale)}
          tick={{ fontSize: 10, fill: chartTheme.axisColor }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip
          {...chartTooltipStyle}
          labelFormatter={(v) => formatReplayBarTime(Number(v), interval, locale)}
          formatter={(value) => [
            pnlTooltipValue(
              Number(value ?? 0),
              fmtSignedMoney(Number(value ?? 0), currency, locale),
            ),
            "Open P&L",
          ]}
        />
        <ReferenceLine y={0} stroke={chartTheme.axisColor} strokeOpacity={0.35} />
        {mfe > 0 && (
          <ReferenceLine
            y={mfe}
            stroke="var(--profit)"
            strokeDasharray="4 3"
            strokeOpacity={0.7}
            label={refPill(`MFE ${fmtSignedMoneyCompact(mfe, currency, locale)}`, "var(--profit)")}
          />
        )}
        {mae > 0 && (
          <ReferenceLine
            y={-mae}
            stroke="var(--loss)"
            strokeDasharray="4 3"
            strokeOpacity={0.7}
            label={refPill(`MAE ${fmtSignedMoneyCompact(-mae, currency, locale)}`, "var(--loss)")}
          />
        )}
        <Area
          type="monotone"
          dataKey="equity"
          stroke="url(#excursion-stroke)"
          strokeWidth={1.5}
          fill="url(#excursion-fill)"
          baseValue={0}
          dot={false}
          isAnimationActive={false}
        />
        <ReferenceDot
          x={first.time}
          y={first.equity}
          r={3.5}
          fill={chartTheme.axisColor}
          stroke="var(--card)"
          strokeWidth={1.5}
        />
        <ReferenceDot
          x={last.time}
          y={last.equity}
          r={3.5}
          fill={last.equity >= 0 ? "var(--profit)" : "var(--loss)"}
          stroke="var(--card)"
          strokeWidth={1.5}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
