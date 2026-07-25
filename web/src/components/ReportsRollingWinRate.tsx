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
import type { Trade } from "@/lib/api/types";
import { fmtPct } from "@/lib/format";
import { intlLocale } from "@/lib/locale";
import { rollingWinRate } from "@/lib/reportsAnalytics";

const WINDOWS = [10, 20, 50, 100];

export interface ReportsRollingWinRateProps {
  trades: Trade[];
  loading: boolean;
  error: boolean;
}

export function ReportsRollingWinRate({ trades, loading, error }: ReportsRollingWinRateProps) {
  const locale = intlLocale();
  const [windowSize, setWindowSize] = useState(WINDOWS[0]);

  const points = rollingWinRate(trades, windowSize);
  const latest = points.length > 0 ? points[points.length - 1].rate : null;

  const action = (
    <SegmentedControl
      ariaLabel="Rolling window"
      value={String(windowSize)}
      onChange={(v) => setWindowSize(Number(v))}
      options={WINDOWS.map((w) => ({ value: String(w), label: String(w) }))}
    />
  );

  return (
    <Card title="Rolling Win Rate" action={action}>
      {loading ? (
        <Skeleton height="200px" />
      ) : error ? (
        <p className="text-xs text-destructive">Failed to load rolling win rate.</p>
      ) : points.length === 0 ? (
        <EmptyState
          title="Not enough trades"
          hint={`Need at least ${windowSize} closed trades to compute a rolling window.`}
        />
      ) : (
        <>
          <p className="mb-3 text-[43px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-foreground">
            {fmtPct(latest ?? 0, locale)}
          </p>
          <ChartFrame className="border-0 rounded-none">
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke={chartTheme.gridColor} />
                <XAxis
                  dataKey="index"
                  tick={{ fontSize: 10, fill: chartTheme.axisColor }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: chartTheme.axisColor }}
                  tickFormatter={(v: number) => fmtPct(v, locale)}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  domain={[0, 1]}
                />
                <Tooltip
                  contentStyle={{
                    background: chartTheme.tooltipBg,
                    border: `1px solid ${chartTheme.tooltipBorder}`,
                    color: chartTheme.tooltipText,
                    fontSize: 11,
                  }}
                  formatter={(value) => [fmtPct(Number(value ?? 0), locale), "Win rate"]}
                  labelFormatter={(v) => `Trade #${v}`}
                />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke={chartTheme.accentStroke}
                  strokeWidth={1.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartFrame>
        </>
      )}
    </Card>
  );
}
