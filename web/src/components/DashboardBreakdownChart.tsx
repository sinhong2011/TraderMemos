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
import { ArrowRight } from "lucide-react";
import type { BreakGroup } from "../lib/api/types";
import { fmtMoneyCompact, fmtSignedMoney } from "../lib/format";
import { intlLocale } from "../lib/locale";
import { ChartFrame, chartTheme } from "./ChartFrame";
import { SegmentedControl } from "./SegmentedControl";
import { Skeleton } from "./Skeleton";
import { Button } from "./ui/button";
import { usePrivacyMode } from "../lib/displayPrefs";

export type DashboardBreakdownDim = "day_of_week" | "setup" | "symbol";

const DIM_OPTIONS: { value: DashboardBreakdownDim; label: string }[] = [
  { value: "day_of_week", label: "Day" },
  { value: "setup", label: "Setup" },
  { value: "symbol", label: "Symbol" },
];

const POS = "var(--profit)";
const NEG = "var(--loss)";

export interface DashboardBreakdownChartProps {
  dim: DashboardBreakdownDim;
  onDimChange: (dim: DashboardBreakdownDim) => void;
  breakdown: BreakGroup[];
  loading: boolean;
  error: boolean;
  currency: string;
  fxRate?: number;
  onOpenReports: () => void;
}

export function DashboardBreakdownChart({
  dim,
  onDimChange,
  breakdown,
  loading,
  error,
  currency,
  fxRate = 1,
  onOpenReports,
}: DashboardBreakdownChartProps) {
  usePrivacyMode();
  const locale = intlLocale();
  const chartData = breakdown.slice(0, 8).map((g) => ({
    key: g.key.length > 10 ? `${g.key.slice(0, 9)}…` : g.key,
    fullKey: g.key,
    net_pnl: g.summary.net_pnl * fxRate,
  }));

  return (
    <section className="flex h-full flex-col rounded-lg bg-card">
      <header className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
        <h2 className="text-[10px] font-semibold tracking-wide text-chart-3">Breakdown</h2>
        <SegmentedControl
          ariaLabel="Breakdown dimension"
          options={DIM_OPTIONS}
          value={dim}
          onChange={(v) => onDimChange(v as DashboardBreakdownDim)}
        />
      </header>

      <div className="flex min-h-0 flex-1 flex-col px-2 pb-3">
        <div className="min-h-0 flex-1">
          {loading ? (
            <Skeleton height="180px" className="mx-2" />
          ) : error ? (
            <p className="px-2 text-xs text-destructive">Failed to load breakdown.</p>
          ) : chartData.length === 0 ? (
            <p className="px-2 py-8 text-center text-xs text-muted-foreground">
              No breakdown data yet.
            </p>
          ) : (
            <ChartFrame inset className="rounded-none border-0 bg-transparent">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke={chartTheme.gridColor} />
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
                    width={48}
                  />
                  <Tooltip
                    contentStyle={{
                      background: chartTheme.tooltipBg,
                      border: `1px solid ${chartTheme.tooltipBorder}`,
                      color: chartTheme.tooltipText,
                      fontSize: 11,
                      borderRadius: "var(--radius)",
                    }}
                    labelFormatter={(_, payload) => String(payload?.[0]?.payload?.fullKey ?? _)}
                    formatter={(value) => [
                      fmtSignedMoney(Number(value ?? 0), currency, locale),
                      "Net P&L",
                    ]}
                    cursor={{ fill: chartTheme.cursorFill }}
                  />
                  <Bar dataKey="net_pnl" radius={[2, 2, 0, 0]}>
                    {chartData.map((entry) => (
                      <Cell
                        key={entry.fullKey}
                        fill={entry.net_pnl >= 0 ? POS : NEG}
                        fillOpacity={0.85}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartFrame>
          )}
        </div>
        <div className="mt-2 flex justify-end px-2">
          <Button
            type="button"
            variant="link"
            onClick={onOpenReports}
            className="h-auto gap-1 text-[11px] font-medium"
          >
            Reports
            <ArrowRight size={12} strokeWidth={2} aria-hidden />
          </Button>
        </div>
      </div>
    </section>
  );
}
