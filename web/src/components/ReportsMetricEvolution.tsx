import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "./Card";
import { ChartFrame, chartTheme } from "./ChartFrame";
import { EmptyState } from "./EmptyState";
import { SegmentedControl } from "./SegmentedControl";
import { Skeleton } from "./Skeleton";
import type { Trade } from "../lib/api/types";
import { fmtDayShort, fmtMoneyCompact, fmtPct } from "../lib/format";
import { intlLocale } from "../lib/locale";
import {
  type EvolutionGranularity,
  type EvolutionPoint,
  metricEvolution,
} from "../lib/reportsAnalytics";

// "Avg P&L/Trade" is deliberately not offered here: it's algebraically identical
// to "Expectancy" in this cumulative-to-date computation (winRate*avgWin -
// lossRate*avgLoss reduces to cumulativePnl/count for any bucket), so the two
// would always render as the same line. `avgPnlPerTrade` still exists on
// `EvolutionPoint` (lib/reportsAnalytics.ts) but isn't wired to this selector.
type RightMetric = "cumulativePnl" | "profitFactor" | "expectancy";

const RIGHT_METRICS: { value: RightMetric; label: string }[] = [
  { value: "cumulativePnl", label: "Cumulative P&L" },
  { value: "profitFactor", label: "Profit Factor" },
  { value: "expectancy", label: "Expectancy" },
];

const GRANULARITIES: { value: EvolutionGranularity; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

export interface ReportsMetricEvolutionProps {
  trades: Trade[];
  loading: boolean;
  error: boolean;
  currency: string;
  fxRate?: number;
}

function rightFormatter(metric: RightMetric, currency: string, locale: string) {
  if (metric === "profitFactor") return (v: number) => v.toFixed(2);
  return (v: number) => fmtMoneyCompact(v, currency, locale);
}

export function ReportsMetricEvolution({
  trades,
  loading,
  error,
  currency,
  fxRate = 1,
}: ReportsMetricEvolutionProps) {
  const locale = intlLocale();
  const [granularity, setGranularity] = useState<EvolutionGranularity>("week");
  const [rightMetric, setRightMetric] = useState<RightMetric>("cumulativePnl");

  const rawPoints = metricEvolution(trades, granularity);
  const points: EvolutionPoint[] = rawPoints.map((p) => ({
    ...p,
    cumulativePnl: p.cumulativePnl * fxRate,
    expectancy: p.expectancy * fxRate,
  }));
  const fmtRight = rightFormatter(rightMetric, currency, locale);
  const rightLabel = RIGHT_METRICS.find((m) => m.value === rightMetric)?.label ?? "";
  const lastRightValue = points.length > 0 ? points[points.length - 1][rightMetric] : 0;
  const rightColor = lastRightValue < 0 ? "var(--color-loss)" : "var(--color-profit)";

  const action = (
    // Side-by-side once there's room (sm+), stacked below that: "Right axis
    // metric" alone can exceed a narrow card's width, so each control keeps
    // its own row there. overflow-x-auto is a fallback so an over-wide
    // control scrolls within itself rather than breaking the page layout at
    // the very narrowest viewports.
    <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4">
      <div className="max-w-full overflow-x-auto">
        <SegmentedControl
          ariaLabel="Evolution granularity"
          value={granularity}
          onChange={(v) => setGranularity(v as EvolutionGranularity)}
          options={GRANULARITIES}
        />
      </div>
      <div className="max-w-full overflow-x-auto">
        <SegmentedControl
          ariaLabel="Right axis metric"
          value={rightMetric}
          onChange={(v) => setRightMetric(v as RightMetric)}
          options={RIGHT_METRICS}
        />
      </div>
    </div>
  );

  return (
    <Card title="Metric Evolution" action={action}>
      {loading ? (
        <Skeleton height="220px" />
      ) : error ? (
        <p className="text-xs text-loss">Failed to load metric evolution.</p>
      ) : points.length === 0 ? (
        <EmptyState title="No data" hint="Add trades or adjust filters to see trends over time." />
      ) : (
        <ChartFrame className="border-0 rounded-none">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={chartTheme.gridColor} />
              <XAxis
                dataKey="bucket"
                tickFormatter={(v: string) => fmtDayShort(v, locale)}
                tick={{ fontSize: 10, fill: chartTheme.axisColor }}
                axisLine={false}
                tickLine={false}
                minTickGap={40}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 10, fill: chartTheme.axisColor }}
                tickFormatter={(v: number) => fmtPct(v, locale)}
                axisLine={false}
                tickLine={false}
                width={44}
                domain={[0, 1]}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 10, fill: chartTheme.axisColor }}
                tickFormatter={fmtRight}
                axisLine={false}
                tickLine={false}
                width={56}
              />
              <Tooltip
                contentStyle={{
                  background: chartTheme.tooltipBg,
                  border: `1px solid ${chartTheme.tooltipBorder}`,
                  color: chartTheme.tooltipText,
                  fontSize: 11,
                }}
                labelFormatter={(v) => fmtDayShort(String(v), locale)}
                formatter={(value, name) => [
                  name === "winRate"
                    ? fmtPct(Number(value ?? 0), locale)
                    : fmtRight(Number(value ?? 0)),
                  name === "winRate" ? "Win rate" : rightLabel,
                ]}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="winRate"
                name="winRate"
                stroke={chartTheme.accentStroke}
                strokeWidth={1.5}
                dot={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey={rightMetric}
                name={rightMetric}
                stroke={rightColor}
                strokeWidth={1.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartFrame>
      )}
    </Card>
  );
}
