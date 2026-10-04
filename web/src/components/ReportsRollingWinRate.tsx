import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard } from "./ChartCard";
import { ChartFrame, chartTheme, chartTooltipStyle } from "./ChartFrame";
import { EmptyState } from "./EmptyState";
import { useReportsMoney } from "./ReportsDisplayContext";
import { SegmentedControl } from "./SegmentedControl";
import { Skeleton } from "./Skeleton";
import type { Trade } from "@/lib/api/types";
import { type ChartRange, tradesInRange } from "@/lib/chartRange";
import { cn } from "@/lib/cn";
import { PRIVACY_MASK, usePrivacyMode } from "@/lib/displayPrefs";
import { fmtPct, fmtSignedPct } from "@/lib/format";
import { intlLocale } from "@/lib/locale";
import { rollingBaseline, rollingWinRate } from "@/lib/reportsAnalytics";

const WINDOWS = [10, 20, 50, 100];

type RollingMetric = "rate" | "avgPnl";

const METRICS: { value: RollingMetric; label: string }[] = [
  { value: "rate", label: "Win rate" },
  { value: "avgPnl", label: "Avg P&L" },
];

export interface ReportsRollingWinRateProps {
  trades: Trade[];
  loading: boolean;
  error: boolean;
}

/**
 * Rolling performance: win rate or mean P&L per trade over the last N trades,
 * against a dashed line for the same metric across every trade in range — so
 * a recent run reads as above or below the trader's own norm.
 */
export function ReportsRollingWinRate({ trades, loading, error }: ReportsRollingWinRateProps) {
  // The money formatters read privacy mode at call time, which React Compiler
  // cannot see: it would keep serving the pre-flip string. Branching on the
  // subscribed flag makes it an input the compiler tracks.
  const privacy = usePrivacyMode();
  const locale = intlLocale();
  const money = useReportsMoney();
  const [windowSize, setWindowSize] = useState(WINDOWS[0]);
  const [metric, setMetric] = useState<RollingMetric>("rate");
  const [range, setRange] = useState<ChartRange>("all");

  const ranged = tradesInRange(trades, range);
  const closedCount = ranged.filter((t) => t.closed_at).length;
  // avgPnl leaves in display units (fx, % of capital) so the axis, tooltip
  // and baseline share one scale; win rate is unitless.
  const points = rollingWinRate(ranged, windowSize, money.tradePnl).map((p) => ({
    ...p,
    avgPnl: money.display(p.avgPnl),
  }));
  const rawBaseline = rollingBaseline(ranged, money.tradePnl);
  const baseline =
    rawBaseline == null
      ? null
      : metric === "rate"
        ? rawBaseline.rate
        : money.display(rawBaseline.avgPnl);
  const latest = points.length > 0 ? points[points.length - 1][metric] : null;

  const fmtValue = (v: number) =>
    metric === "rate"
      ? fmtPct(v, locale)
      : money.unitMode === "pct"
        ? // A per-trade average is a fraction of a percent of capital; the
          // shared whole-percent axis format would round it to 0%.
          fmtSignedPct(v, locale)
        : privacy
          ? PRIVACY_MASK
          : money.formatAxis(v);
  const metricLabel = METRICS.find((m) => m.value === metric)?.label ?? "";

  const controls = (
    <>
      <SegmentedControl
        ariaLabel="Rolling metric"
        value={metric}
        onChange={(v) => setMetric(v as RollingMetric)}
        options={METRICS}
      />
      <SegmentedControl
        ariaLabel="Rolling window"
        value={String(windowSize)}
        onChange={(v) => setWindowSize(Number(v))}
        options={WINDOWS.map((w) => ({ value: String(w), label: String(w) }))}
      />
    </>
  );

  const body = ({ height }: { height?: number }) =>
    loading ? (
      <Skeleton height="200px" />
    ) : error ? (
      <p className="text-xs text-destructive">Failed to load rolling performance.</p>
    ) : points.length === 0 || latest == null ? (
      <EmptyState
        title="Not enough trades"
        hint={`Need at least ${windowSize} closed trades in range to compute a rolling window.`}
      />
    ) : (
      <>
        <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p
            className="text-[43px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-foreground"
            data-testid="rolling-latest"
          >
            {fmtValue(latest)}
          </p>
          {baseline != null ? (
            <p
              className="text-xs text-muted-foreground tabular-nums"
              data-testid="rolling-baseline"
            >
              <span
                className={cn(latest > baseline && "text-profit", latest < baseline && "text-loss")}
              >
                {latest > baseline ? "Above" : latest < baseline ? "Below" : "At"}
              </span>{" "}
              {fmtValue(baseline)} across all {closedCount} trades
            </p>
          ) : null}
        </div>
        <ChartFrame className="border-0 rounded-none">
          <ResponsiveContainer width="100%" height={height ?? 160}>
            <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={chartTheme.gridColor} />
              <XAxis
                dataKey="index"
                tick={{ fontSize: 11, fill: chartTheme.axisColor }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: chartTheme.axisColor }}
                tickFormatter={fmtValue}
                axisLine={false}
                tickLine={false}
                width={metric === "rate" ? 48 : 64}
                domain={metric === "rate" ? [0, 1] : ["auto", "auto"]}
              />
              <Tooltip
                {...chartTooltipStyle}
                formatter={(value) => [fmtValue(Number(value ?? 0)), metricLabel]}
                labelFormatter={(v) => `Trade #${v}`}
              />
              {baseline != null ? (
                <ReferenceLine
                  y={baseline}
                  stroke={chartTheme.axisColor}
                  strokeDasharray="4 4"
                  strokeOpacity={0.6}
                />
              ) : null}
              <Line
                type="monotone"
                dataKey={metric}
                stroke={chartTheme.accentStroke}
                strokeWidth={1.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartFrame>
      </>
    );

  return (
    <ChartCard
      title="Rolling Performance"
      controls={controls}
      range={range}
      onRangeChange={setRange}
    >
      {body}
    </ChartCard>
  );
}
