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
import type { RSummary } from "../lib/api/types";
import { usePrivacyMode } from "../lib/displayPrefs";
import { Card } from "./Card";
import { ChartFrame, chartTheme } from "./ChartFrame";
import { EmptyState } from "./EmptyState";
import { Skeleton } from "./Skeleton";
import { StatCard } from "./StatCard";

export interface ReportsRMultiplePerformanceProps {
  rSummary?: RSummary;
  loading: boolean;
  error: boolean;
}

const POS = "var(--color-profit)";
const NEG = "var(--color-loss)";

function formatR(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}R`;
}

export function ReportsRMultiplePerformance({
  rSummary,
  loading,
  error,
}: ReportsRMultiplePerformanceProps) {
  usePrivacyMode();
  // `total_trades` here is already the R-eligible (included) count — `excluded`
  // is a disjoint count of trades skipped for missing risk, not a subset of it.
  const included = rSummary?.total_trades ?? 0;
  const distribution = rSummary?.distribution ?? [];
  const excluded = rSummary?.excluded ?? 0;
  const hasData = Boolean(rSummary && included > 0);

  return (
    <Card title="R-Multiples">
      {loading ? (
        <Skeleton height="280px" />
      ) : error ? (
        <p className="text-xs text-loss">Failed to load R-multiple performance.</p>
      ) : !hasData ? (
        <EmptyState title="No R data" hint="Set stops on your trades to see R-multiples." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              variant="bento"
              align="center"
              label="Avg R/Trade"
              value={formatR(rSummary!.avg_r)}
              accent={rSummary!.avg_r >= 0 ? "pos" : "neg"}
              hint={`${included} of ${included + excluded} trades`}
            />
            <StatCard
              variant="bento"
              align="center"
              label="Avg Winning R"
              value={formatR(rSummary!.avg_win_r)}
              accent="pos"
            />
            <StatCard
              variant="bento"
              align="center"
              label="Avg Losing R"
              value={formatR(rSummary!.avg_loss_r)}
              accent="neg"
            />
            <StatCard
              variant="bento"
              align="center"
              label="Best / Worst R"
              value={`${formatR(rSummary!.best_r)} / ${formatR(rSummary!.worst_r)}`}
            />
          </div>

          {distribution.length > 0 ? (
            <div className="mt-4">
              <ChartFrame className="rounded-none border-0">
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
                      formatter={(value) => {
                        const count = Number(value ?? 0);
                        const pct = included > 0 ? ((count / included) * 100).toFixed(0) : "0";
                        return [`${count} (${pct}%)`, "Trades"];
                      }}
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
                Showing {included} of {included + excluded} closed trades
                {excluded > 0 ? `, ${excluded} excluded (no stop)` : ""}
              </p>
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}
