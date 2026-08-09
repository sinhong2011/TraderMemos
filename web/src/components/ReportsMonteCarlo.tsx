import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonteCarloResult } from "@/lib/api/types";
import { useDisplayTimePrefs, usePrivacyMode } from "@/lib/displayPrefs";
import { fmtMoneyCompact, fmtPct } from "@/lib/format";
import { intlLocale } from "@/lib/locale";
import { Card } from "./Card";
import { ChartFrame, chartTheme, chartTooltipStyle } from "./ChartFrame";
import { EmptyState } from "./EmptyState";
import { useReportsMoney } from "./ReportsDisplayContext";
import { Skeleton } from "./Skeleton";
import { StatCard } from "./StatCard";

export interface ReportsMonteCarloProps {
  simulation: MonteCarloResult | undefined;
  loading: boolean;
  error: boolean;
  currency: string;
}

/**
 * Fan chart of bootstrap-resampled equity paths: the p05–p95 and p25–p75
 * bands plus the median, over the same number of trades as the sample.
 * The simulation is net-P&L only, so the gross toggle does not apply.
 */
export function ReportsMonteCarlo({
  simulation,
  loading,
  error,
  currency,
}: ReportsMonteCarloProps) {
  usePrivacyMode();
  useDisplayTimePrefs();
  const money = useReportsMoney();
  const locale = intlLocale();

  const points = (simulation?.steps ?? []).map((b) => ({
    n: b.n,
    band90: [money.display(b.p05), money.display(b.p95)],
    band50: [money.display(b.p25), money.display(b.p75)],
    median: money.display(b.p50),
  }));

  return (
    <Card title="Monte Carlo">
      {loading ? (
        <Skeleton height="240px" />
      ) : error ? (
        <p className="text-xs text-destructive">Failed to load simulation.</p>
      ) : !simulation || simulation.insufficient_data ? (
        <EmptyState
          title="Not enough closed trades"
          hint="The simulation needs at least 10 closed trades to resample."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              variant="bento"
              align="center"
              label="Median Outcome"
              value={money.format(simulation.terminal.p50)}
              accent={simulation.terminal.p50 >= 0 ? "pos" : "neg"}
              hint={`over the next ${simulation.horizon} trades`}
            />
            <StatCard
              variant="bento"
              align="center"
              label="5th Percentile"
              value={money.format(simulation.terminal.p05)}
              accent={simulation.terminal.p05 < 0 ? "neg" : "none"}
              hint="bad-luck outcome"
            />
            <StatCard
              variant="bento"
              align="center"
              label="Chance of Loss"
              value={fmtPct(simulation.terminal.prob_negative, locale)}
              accent={simulation.terminal.prob_negative > 0.25 ? "neg" : "none"}
              hint="paths ending below zero"
            />
            <StatCard
              variant="bento"
              align="center"
              label="Risk of Ruin"
              value={fmtPct(simulation.risk_of_ruin, locale)}
              accent={simulation.risk_of_ruin > 0.1 ? "neg" : "none"}
              hint={`drawdown ≥ ${fmtMoneyCompact(simulation.ruin_threshold, currency, locale)}`}
            />
          </div>
          <div className="mt-4">
            <ChartFrame className="rounded-none border-0">
              <ResponsiveContainer width="100%" height={180}>
                <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
                  <CartesianGrid vertical={false} stroke={chartTheme.gridColor} />
                  <XAxis
                    dataKey="n"
                    tick={{ fontSize: 10, fill: chartTheme.axisColor }}
                    tickFormatter={(v: number) => String(v)}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={40}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: chartTheme.axisColor }}
                    tickFormatter={(v: number) => money.formatAxis(v)}
                    axisLine={false}
                    tickLine={false}
                    width={56}
                  />
                  <Tooltip
                    {...chartTooltipStyle}
                    labelFormatter={(n) => `After ${String(n)} trades`}
                    formatter={(value, name) => {
                      if (Array.isArray(value)) {
                        const [lo, hi] = value as [number, number];
                        return [
                          `${money.formatAxis(lo)} … ${money.formatAxis(hi)}`,
                          name === "band90" ? "5–95%" : "25–75%",
                        ];
                      }
                      return [money.formatAxis(Number(value ?? 0)), "Median"];
                    }}
                  />
                  <Area
                    dataKey="band90"
                    stroke="none"
                    fill="var(--primary)"
                    fillOpacity={0.1}
                    isAnimationActive={false}
                  />
                  <Area
                    dataKey="band50"
                    stroke="none"
                    fill="var(--primary)"
                    fillOpacity={0.18}
                    isAnimationActive={false}
                  />
                  <Line
                    dataKey="median"
                    stroke="var(--primary)"
                    strokeWidth={1.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartFrame>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            {simulation.paths.toLocaleString(locale)} resamples of your {simulation.trades} closed
            trades&apos; net P&amp;L — assumes each trade is an independent draw from your history,
            so streaks and changing conditions are understated.
          </p>
        </>
      )}
    </Card>
  );
}
