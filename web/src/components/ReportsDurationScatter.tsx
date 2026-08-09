import {
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Trade } from "@/lib/api/types";
import { fmtDuration } from "@/lib/format";
import { durationScatter, medianDurationSecs } from "@/lib/reportsAnalytics";
import { usePrivacyMode } from "@/lib/displayPrefs";
import { Card } from "./Card";
import { ChartFrame, chartTheme, chartTooltipStyle, pnlTooltipValue } from "./ChartFrame";
import { EmptyState } from "./EmptyState";
import { useReportsMoney } from "./ReportsDisplayContext";
import { Skeleton } from "./Skeleton";

const POS_COLOR = "var(--profit)";
const NEG_COLOR = "var(--loss)";

/** Candidate log-axis ticks: 1m, 5m, 15m, 1h, 4h, 1d, 1w, 1mo. */
const DURATION_TICKS = [60, 300, 900, 3600, 14400, 86400, 604800, 2592000];

export interface ReportsDurationScatterProps {
  trades: Trade[];
  loading: boolean;
  error: boolean;
  onSelectTradeId?: (id: string) => void;
}

/**
 * Hold time (log x) vs P&L scatter — shows the shape the duration buckets
 * flatten. Dots are outcome-colored; the dashed line marks median hold time.
 */
export function ReportsDurationScatter({
  trades,
  loading,
  error,
  onSelectTradeId,
}: ReportsDurationScatterProps) {
  usePrivacyMode();
  const money = useReportsMoney();

  const points = durationScatter(trades, money.tradePnl);
  const median = medianDurationSecs(points);
  const data = points.map((p) => ({ ...p, value: money.display(p.pnl) }));
  const minSecs = points.length > 0 ? Math.min(...points.map((p) => p.secs)) : 0;
  const maxSecs = points.length > 0 ? Math.max(...points.map((p) => p.secs)) : 0;
  const ticks = DURATION_TICKS.filter((t) => t >= minSecs && t <= maxSecs);

  return (
    <Card title="Duration vs P&L">
      {loading ? (
        <Skeleton height="240px" />
      ) : error ? (
        <p className="text-xs text-destructive">Failed to load trades.</p>
      ) : points.length === 0 ? (
        <EmptyState title="No data" hint="Close trades with hold times to see the scatter." />
      ) : (
        <>
          <ChartFrame className="border-0 rounded-none">
            <ResponsiveContainer width="100%" height={240}>
              <ScatterChart margin={{ top: 12, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid stroke={chartTheme.gridColor} />
                <XAxis
                  dataKey="secs"
                  type="number"
                  scale="log"
                  domain={["dataMin", "dataMax"]}
                  ticks={ticks.length > 0 ? ticks : undefined}
                  tick={{ fontSize: 10, fill: chartTheme.axisColor }}
                  tickFormatter={(v: number) => fmtDuration(v)}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  dataKey="value"
                  type="number"
                  tick={{ fontSize: 10, fill: chartTheme.axisColor }}
                  tickFormatter={(v: number) => money.formatAxis(v)}
                  axisLine={false}
                  tickLine={false}
                  width={72}
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  {...chartTooltipStyle}
                  cursor={{ stroke: chartTheme.gridColor }}
                  // Scatter tooltips fire per-axis; label the pair off the point payload.
                  formatter={(value, name, item) => {
                    const p = item?.payload as (typeof data)[number] | undefined;
                    if (name === "secs") return [fmtDuration(Number(value ?? 0)), "Hold time"];
                    return [
                      pnlTooltipValue(Number(value ?? 0), money.formatAxis(Number(value ?? 0))),
                      p?.symbol ?? "P&L",
                    ];
                  }}
                />
                <ReferenceLine
                  x={median}
                  stroke={chartTheme.axisColor}
                  strokeDasharray="4 3"
                  label={{
                    value: `median ${fmtDuration(median)}`,
                    position: "top",
                    fontSize: 10,
                    fill: chartTheme.axisColor,
                  }}
                />
                <ReferenceLine y={0} stroke={chartTheme.axisColor} strokeOpacity={0.4} />
                <Scatter
                  data={data}
                  isAnimationActive={false}
                  onClick={(entry) => {
                    const id = (entry as { payload?: { id?: string } }).payload?.id;
                    if (id) onSelectTradeId?.(id);
                  }}
                  cursor={onSelectTradeId ? "pointer" : undefined}
                >
                  {data.map((p) => (
                    <Cell key={p.id} fill={p.pnl >= 0 ? POS_COLOR : NEG_COLOR} fillOpacity={0.65} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </ChartFrame>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Hold time on a log scale · dashed line marks the median hold
          </p>
        </>
      )}
    </Card>
  );
}
