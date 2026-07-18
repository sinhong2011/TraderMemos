import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "./Card";
import { ChartFrame, chartTheme } from "./ChartFrame";
import { EmptyState } from "./EmptyState";
import { Skeleton } from "./Skeleton";
import { StatCard } from "./StatCard";
import type { EquityPoint, Trade } from "../lib/api/types";
import { uniqueDayTicks } from "../lib/chartTicks";
import { computeDashboardInsights } from "../lib/dashboardInsights";
import { usePrivacyMode } from "../lib/displayPrefs";
import { fmtDayShort, fmtMoney } from "../lib/format";
import { intlLocale } from "../lib/locale";
import {
  avgRiskPerTrade,
  currentDrawdownPct,
  drawdownSeries,
  maxDrawdownPct,
} from "../lib/reportsAnalytics";

export interface ReportsRiskDrawdownProps {
  trades: Trade[];
  equityPoints: EquityPoint[];
  loading: boolean;
  error: boolean;
  currency: string;
  fxRate?: number;
}

function fmtDrawdownPct(v: number): string {
  return `${(v * 100).toFixed(2)}%`;
}

export function ReportsRiskDrawdown({
  trades,
  equityPoints,
  loading,
  error,
  currency,
  fxRate = 1,
}: ReportsRiskDrawdownProps) {
  usePrivacyMode();
  const locale = intlLocale();
  const insights = computeDashboardInsights(trades);
  const risk = avgRiskPerTrade(trades);
  const series = drawdownSeries(equityPoints);
  const maxDd = maxDrawdownPct(equityPoints);
  const currentDd = currentDrawdownPct(equityPoints);

  return (
    <Card title="Risk & Drawdown">
      {loading ? (
        <Skeleton height="240px" />
      ) : error ? (
        <p className="text-xs text-loss">Failed to load risk &amp; drawdown.</p>
      ) : equityPoints.length === 0 ? (
        <EmptyState title="No data" hint="Add trades to see risk and drawdown stats." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Max Drawdown" value={fmtDrawdownPct(maxDd)} accent="neg" />
            <StatCard
              label="Current Drawdown"
              value={fmtDrawdownPct(currentDd)}
              accent={currentDd < 0 ? "neg" : "none"}
            />
            <StatCard
              label="Longest Losing Streak"
              value={insights.worstStreak > 0 ? `${insights.worstStreak} trades` : "—"}
            />
            <StatCard
              label="Avg Risk/Trade"
              value={risk.avg != null ? fmtMoney(risk.avg * fxRate, currency, locale) : "—"}
              hint={
                risk.avg != null
                  ? `${risk.included} of ${risk.included + risk.excluded} trades`
                  : undefined
              }
            />
          </div>
          <div className="mt-4">
            <ChartFrame className="border-0 rounded-none">
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
                  <defs>
                    <linearGradient id="dd-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-loss)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--color-loss)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke={chartTheme.gridColor} />
                  <XAxis
                    dataKey="at"
                    ticks={uniqueDayTicks(series)}
                    tickFormatter={(v: string) => fmtDayShort(v, locale)}
                    tick={{ fontSize: 10, fill: chartTheme.axisColor }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={60}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: chartTheme.axisColor }}
                    tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                    axisLine={false}
                    tickLine={false}
                    width={44}
                    domain={["auto", 0]}
                  />
                  <Tooltip
                    contentStyle={{
                      background: chartTheme.tooltipBg,
                      border: `1px solid ${chartTheme.tooltipBorder}`,
                      color: chartTheme.tooltipText,
                      fontSize: 11,
                    }}
                    formatter={(value) => [fmtDrawdownPct(Number(value ?? 0)), "Drawdown"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="drawdownPct"
                    stroke="var(--color-loss)"
                    strokeWidth={1.5}
                    fill="url(#dd-fill)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartFrame>
          </div>
        </>
      )}
    </Card>
  );
}
