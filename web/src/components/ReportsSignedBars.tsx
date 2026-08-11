import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BreakGroup } from "@/lib/api/types";
import { formatHourKeyLabel, useDisplayTimePrefs, usePrivacyMode } from "@/lib/displayPrefs";
import { Card } from "./Card";
import { ChartFrame, chartTheme, chartTooltipStyle, pnlTooltipValue } from "./ChartFrame";
import { EmptyState } from "./EmptyState";
import { useReportsMoney } from "./ReportsDisplayContext";
import { SegmentedControl } from "./SegmentedControl";
import { Skeleton } from "./Skeleton";

const POS_COLOR = "var(--profit)";
const NEG_COLOR = "var(--loss)";

const SESSION_ORDER = ["Premarket", "RTH", "Afterhours", "Overnight"];

type Dim = "hour" | "session";

export interface ReportsSignedBarsProps {
  hourBreakdown: BreakGroup[];
  sessionBreakdown: BreakGroup[];
  loading: boolean;
  error: boolean;
}

/**
 * Wins above the zero line, losses below, per hour or session. A net bar hides
 * the high-volume-both-ways bucket — the actionable one — so this splits the
 * win/loss sums instead of netting them.
 */
export function ReportsSignedBars({
  hourBreakdown,
  sessionBreakdown,
  loading,
  error,
}: ReportsSignedBarsProps) {
  usePrivacyMode();
  useDisplayTimePrefs();
  const money = useReportsMoney();
  const [dim, setDim] = useState<Dim>("hour");

  const breakdown = dim === "hour" ? hourBreakdown : sessionBreakdown;
  const chartData = [...breakdown]
    .sort((a, b) =>
      dim === "hour"
        ? a.key.localeCompare(b.key)
        : SESSION_ORDER.indexOf(a.key) - SESSION_ORDER.indexOf(b.key),
    )
    .map((g) => ({
      key: dim === "hour" ? formatHourKeyLabel(g.key) : g.key,
      wins: money.display(g.summary.gross_profit),
      losses: -money.display(g.summary.gross_loss),
    }));

  const action = (
    <SegmentedControl
      ariaLabel="Win/loss bar dimension"
      size="xs"
      value={dim}
      onChange={(v) => setDim(v as Dim)}
      options={[
        { value: "hour", label: "Hour" },
        { value: "session", label: "Session" },
      ]}
    />
  );

  return (
    <Card title="Win / Loss by Time" action={action}>
      {loading ? (
        <Skeleton height="220px" />
      ) : error ? (
        <p className="text-xs text-destructive">Failed to load breakdown data.</p>
      ) : chartData.length === 0 ? (
        <EmptyState title="No data" hint="Add trades to see win/loss volume by time." />
      ) : (
        <ChartFrame className="border-0 rounded-none">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={chartData}
              stackOffset="sign"
              margin={{ top: 12, right: 16, bottom: 0, left: 0 }}
            >
              <CartesianGrid vertical={false} stroke={chartTheme.gridColor} />
              <XAxis
                dataKey="key"
                tick={{ fontSize: 10, fill: chartTheme.axisColor }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: chartTheme.axisColor }}
                tickFormatter={(v: number) => money.formatAxis(v)}
                axisLine={false}
                tickLine={false}
                width={72}
              />
              <Tooltip
                {...chartTooltipStyle}
                formatter={(value, name) => [
                  pnlTooltipValue(Number(value ?? 0), money.formatAxis(Number(value ?? 0))),
                  name === "wins" ? "Wins" : "Losses",
                ]}
                cursor={{ fill: chartTheme.cursorFill }}
              />
              <ReferenceLine y={0} stroke={chartTheme.axisColor} strokeOpacity={0.4} />
              <Bar
                dataKey="wins"
                stackId="pnl"
                fill={POS_COLOR}
                fillOpacity={0.85}
                radius={[2, 2, 0, 0]}
              />
              <Bar
                dataKey="losses"
                stackId="pnl"
                fill={NEG_COLOR}
                fillOpacity={0.85}
                radius={[0, 0, 2, 2]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>
      )}
    </Card>
  );
}
