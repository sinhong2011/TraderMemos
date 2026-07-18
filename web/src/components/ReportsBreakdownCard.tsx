import type { ColumnDef } from "@tanstack/react-table";
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
import { ChartFrame, chartTheme } from "./ChartFrame";
import { DataTable } from "./DataTable";
import { EmptyState } from "./EmptyState";
import { SegmentedControl } from "./SegmentedControl";
import { Skeleton } from "./Skeleton";
import type { BreakGroup } from "../lib/api/types";
import { usePrivacyMode } from "../lib/displayPrefs";
import { fmtMoneyCompact, fmtSignedMoney } from "../lib/format";
import { intlLocale } from "../lib/locale";

const POS = "var(--color-profit)";
const NEG = "var(--color-loss)";

export interface ReportsBreakdownCardProps {
  title: string;
  breakdown: BreakGroup[];
  loading: boolean;
  error: boolean;
  currency: string;
  fxRate?: number;
  orientation?: "horizontal" | "vertical";
  tableColumns?: ColumnDef<BreakGroup>[];
}

export function ReportsBreakdownCard({
  title,
  breakdown,
  loading,
  error,
  currency,
  fxRate = 1,
  orientation = "vertical",
  tableColumns,
}: ReportsBreakdownCardProps) {
  usePrivacyMode();
  const locale = intlLocale();
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
        <p className="text-xs text-loss">Failed to load {title.toLowerCase()}.</p>
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
              data={breakdown.map((g) => ({ key: g.key, net_pnl: g.summary.net_pnl * fxRate }))}
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
                    tickFormatter={(v: number) => fmtMoneyCompact(v, currency, locale)}
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
                    tickFormatter={(v: number) => fmtMoneyCompact(v, currency, locale)}
                    axisLine={false}
                    tickLine={false}
                    width={56}
                  />
                </>
              )}
              <Tooltip
                contentStyle={{
                  background: chartTheme.tooltipBg,
                  border: `1px solid ${chartTheme.tooltipBorder}`,
                  color: chartTheme.tooltipText,
                  fontSize: 11,
                }}
                formatter={(value) => [
                  fmtSignedMoney(Number(value ?? 0), currency, locale),
                  "Net P&L",
                ]}
                cursor={{ fill: chartTheme.cursorFill }}
              />
              <Bar dataKey="net_pnl" radius={horizontal ? [0, 2, 2, 0] : [2, 2, 0, 0]}>
                {breakdown.map((g) => (
                  <Cell key={g.key} fill={g.summary.net_pnl >= 0 ? POS : NEG} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>
      )}
    </Card>
  );
}
