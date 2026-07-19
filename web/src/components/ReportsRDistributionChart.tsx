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
import { EmptyState } from "./EmptyState";
import { Skeleton } from "./Skeleton";
import type { RBucket } from "../lib/api/types";

const POS = "var(--color-profit)";
const NEG = "var(--color-loss)";

export interface ReportsRDistributionChartProps {
  distribution: RBucket[];
  avgR: number;
  /** R-eligible (included) closed trades — NOT the total closed-trade count. See `excluded`. */
  totalTrades: number;
  /** Closed trades skipped for missing risk — disjoint from `totalTrades`, not a subset. */
  excluded: number;
  loading: boolean;
  error: boolean;
}

export function ReportsRDistributionChart({
  distribution,
  avgR,
  totalTrades,
  excluded,
  loading,
  error,
}: ReportsRDistributionChartProps) {
  return (
    <Card
      title="R-Multiple Distribution"
      action={
        !loading && !error && distribution.length > 0 ? (
          <span className="text-[11px] font-medium text-text-muted">
            Avg {avgR >= 0 ? "+" : ""}
            {avgR.toFixed(2)}R
          </span>
        ) : undefined
      }
    >
      {loading ? (
        <Skeleton height="200px" />
      ) : error ? (
        <p className="text-xs text-loss">Failed to load R-multiple distribution.</p>
      ) : distribution.length === 0 ? (
        <EmptyState title="No R data" hint="Set stops on your trades to see the R distribution." />
      ) : (
        <>
          <ChartFrame className="border-0 rounded-none">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={distribution} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke={chartTheme.gridColor} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: chartTheme.axisColor }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: chartTheme.axisColor }}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: chartTheme.tooltipBg,
                    border: `1px solid ${chartTheme.tooltipBorder}`,
                    color: chartTheme.tooltipText,
                    fontSize: 11,
                  }}
                  formatter={(value) => [String(value), "Trades"]}
                  cursor={{ fill: chartTheme.cursorFill }}
                />
                <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                  {distribution.map((b) => (
                    <Cell key={b.label} fill={b.from < 0 ? NEG : POS} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartFrame>
          <p className="mt-2 text-[11px] text-text-muted">
            Showing {totalTrades} of {totalTrades + excluded} closed trades
            {excluded > 0 ? `, ${excluded} excluded (no stop)` : ""}
          </p>
        </>
      )}
    </Card>
  );
}
