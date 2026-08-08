import type { ColumnDef } from "@/lib/table";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "./Card";
import { ChartFrame, chartTheme, chartTooltipStyle, pnlTooltipValue } from "./ChartFrame";
import { DataTable } from "./DataTable";
import { EmptyState } from "./EmptyState";
import { useReportsMoney } from "./ReportsDisplayContext";
import { SegmentedControl } from "./SegmentedControl";
import { Skeleton } from "./Skeleton";
import type { BreakGroup } from "@/lib/api/types";
import { usePrivacyMode } from "@/lib/displayPrefs";

const POS = "var(--profit)";
const NEG = "var(--loss)";

export interface ReportsBreakdownCardProps {
  title: string;
  breakdown: BreakGroup[];
  loading: boolean;
  error: boolean;
  orientation?: "horizontal" | "vertical";
  tableColumns?: ColumnDef<BreakGroup>[];
}

/** Pure chart-data transform, exported for direct testing since recharts
 * renders zero-size (and so unqueryable) children in jsdom. `pnlOf` defaults
 * to raw net_pnl; the component passes a net/gross + $/%-aware money-based
 * callback. */
export function buildBreakdownChartData(
  breakdown: BreakGroup[],
  pnlOf: (g: BreakGroup) => number = (g) => g.summary.net_pnl,
): { key: string; net_pnl: number }[] {
  return breakdown.map((g) => ({ key: g.key, net_pnl: pnlOf(g) }));
}

export function ReportsBreakdownCard({
  title,
  breakdown,
  loading,
  error,
  orientation = "vertical",
  tableColumns,
}: ReportsBreakdownCardProps) {
  usePrivacyMode();
  const money = useReportsMoney();
  const [view, setView] = useState<"chart" | "table">("chart");
  const horizontal = orientation === "horizontal";

  const action = tableColumns ? (
    <SegmentedControl
      ariaLabel={`${title} view`}
      value={view}
      onChange={(v) => setView(v as "chart" | "table")}
      options={[
        { value: "chart", label: "Chart" },
        { value: "table", label: "Table" },
      ]}
    />
  ) : undefined;

  return (
    <Card title={title} action={action}>
      {loading ? (
        <Skeleton height="220px" />
      ) : error ? (
        <p className="text-xs text-destructive">Failed to load {title.toLowerCase()}.</p>
      ) : breakdown.length === 0 ? (
        <EmptyState title="No data" hint="Add trades or adjust filters to see a breakdown." />
      ) : view === "table" && tableColumns ? (
        <div style={{ maxHeight: 280 }}>
          <DataTable columns={tableColumns} data={breakdown} />
        </div>
      ) : (
        <ChartFrame className="border-0 rounded-none">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={buildBreakdownChartData(breakdown, (g) => money.display(money.pnl(g.summary)))}
              layout={horizontal ? "vertical" : "horizontal"}
              margin={{ top: 8, right: 16, bottom: 0, left: horizontal ? 8 : 0 }}
            >
              <CartesianGrid
                horizontal={!horizontal}
                vertical={horizontal}
                stroke={chartTheme.gridColor}
              />
              {horizontal ? (
                <>
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: chartTheme.axisColor }}
                    tickFormatter={(v: number) => money.formatAxis(v)}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="key"
                    tick={{ fontSize: 10, fill: chartTheme.axisColor }}
                    axisLine={false}
                    tickLine={false}
                    width={64}
                  />
                </>
              ) : (
                <>
                  <XAxis
                    dataKey="key"
                    tick={{ fontSize: 10, fill: chartTheme.axisColor }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: chartTheme.axisColor }}
                    tickFormatter={(v: number) => money.formatAxis(v)}
                    axisLine={false}
                    tickLine={false}
                    width={56}
                  />
                </>
              )}
              <Tooltip
                {...chartTooltipStyle}
                formatter={(value) => [
                  pnlTooltipValue(Number(value ?? 0), money.formatAxis(Number(value ?? 0))),
                  "Net P&L",
                ]}
                cursor={{ fill: chartTheme.cursorFill }}
              />
              <Bar dataKey="net_pnl" radius={horizontal ? [0, 2, 2, 0] : [2, 2, 0, 0]}>
                {breakdown.map((g) => (
                  <Cell
                    key={g.key}
                    fill={money.pnl(g.summary) >= 0 ? POS : NEG}
                    fillOpacity={0.85}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>
      )}
    </Card>
  );
}
