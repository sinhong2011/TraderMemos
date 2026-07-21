import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "../../components/Card";
import { ChartFrame, chartTheme } from "../../components/ChartFrame";
import { DataTable } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import { Page } from "../../components/Page";
import { ReportsBreakdownCard } from "../../components/ReportsBreakdownCard";
import { ReportsDayStrip } from "../../components/ReportsDayStrip";
import { ReportsExecutionGrade } from "../../components/ReportsExecutionGrade";
import { ReportsHourlyList } from "../../components/ReportsHourlyList";
import { ReportsSummaryBento } from "../../components/ReportsSummaryBento";
import { ReportsMetricEvolution } from "../../components/ReportsMetricEvolution";
import { ReportsRiskDrawdown } from "../../components/ReportsRiskDrawdown";
import { ReportsRMultiplePerformance } from "../../components/ReportsRMultiplePerformance";
import { ReportsRollingWinRate } from "../../components/ReportsRollingWinRate";
import { ReportsSessionTable } from "../../components/ReportsSessionTable";
import { ReportsSymbolHeatmap } from "../../components/ReportsSymbolHeatmap";
import { Skeleton } from "../../components/Skeleton";
import { Tabs, TabsContent, TabsIndicator, TabsList, TabsTrigger } from "../../components/Tabs";
import { Button } from "../../components/ui/button";
import { pnlColor } from "../../components/theme-tokens";
import type { BreakGroup, EquityCurve, RSummary, Summary, Trade } from "../../lib/api/types";
import { uniqueDayTicks } from "../../lib/chartTicks";
import { cn } from "../../lib/cn";
import { fmtDayShort, fmtMoney, fmtMoneyCompact, fmtPct, fmtSignedMoney } from "../../lib/format";
import { useMoneyFx } from "../../lib/hooks/useMoneyFx";
import { intlLocale } from "../../lib/locale";
import { usePrivacyMode } from "../../lib/displayPrefs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BreakdownDim =
  | "symbol"
  | "setup"
  | "day_of_week"
  | "hour_of_day"
  | "session"
  | "tag"
  | "mistake"
  | "trade_quality";

const DIM_LABELS: Record<BreakdownDim, string> = {
  symbol: "Symbol",
  setup: "Setup",
  day_of_week: "Day of Week",
  hour_of_day: "Hour",
  session: "Session",
  tag: "Tag",
  mistake: "Mistake",
  trade_quality: "Execution",
};

// Symbol, Tag, Day of Week, Time of Day, and Session each have their own
// always-visible card above; this selector only covers the two dims without one.
const SELECTOR_DIMS: BreakdownDim[] = ["setup", "mistake"];

export type ReportsTab = "overview" | "win-loss" | "detailed" | "risk";

export const REPORT_TABS: { value: ReportsTab; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "win-loss", label: "Win / Loss" },
  { value: "detailed", label: "Detailed" },
  { value: "risk", label: "Risk" },
];

export interface ReportsViewProps {
  summary?: Summary;
  summaryLoading: boolean;
  summaryError: boolean;
  rSummary?: RSummary;
  rSummaryLoading?: boolean;
  rSummaryError?: boolean;
  trades: Trade[];
  tradesLoading: boolean;
  tradesError: boolean;
  equity?: EquityCurve;
  equityLoading: boolean;
  equityError: boolean;
  breakdown: BreakGroup[];
  loading: boolean;
  error: boolean;
  dayOfWeekBreakdown: BreakGroup[];
  dayOfWeekBreakdownLoading: boolean;
  dayOfWeekBreakdownError: boolean;
  hourOfDayBreakdown: BreakGroup[];
  hourOfDayBreakdownLoading: boolean;
  hourOfDayBreakdownError: boolean;
  symbolBreakdown: BreakGroup[];
  symbolBreakdownLoading: boolean;
  symbolBreakdownError: boolean;
  tagBreakdown: BreakGroup[];
  tagBreakdownLoading: boolean;
  tagBreakdownError: boolean;
  sessionBreakdown: BreakGroup[];
  sessionBreakdownLoading: boolean;
  sessionBreakdownError: boolean;
  qualityBreakdown: BreakGroup[];
  qualityBreakdownLoading: boolean;
  qualityBreakdownError: boolean;
  tab: ReportsTab;
  onTabChange: (t: ReportsTab) => void;
  currency: string;
  dim: BreakdownDim;
  onDimChange: (dim: BreakdownDim) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POS_COLOR = "var(--color-profit)";
const NEG_COLOR = "var(--color-loss)";

// ---------------------------------------------------------------------------
// Summary metrics — equity, day strip, insight widgets, bento grid
// ---------------------------------------------------------------------------

function BentoCell({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section
      className={cn("flex h-full min-w-0 flex-col rounded-card bg-bg-panel p-4 sm:p-5", className)}
    >
      {children}
    </section>
  );
}

function BentoTitle({
  children,
  tone = "signal",
  className,
}: {
  children: ReactNode;
  tone?: "signal" | "muted";
  className?: string;
}) {
  return (
    <p
      className={cn(
        "self-start text-left text-[11px] font-semibold tracking-[0.06em] uppercase sm:text-[12px]",
        tone === "signal" ? "text-signal" : "font-medium normal-case tracking-wide text-text-muted",
        className,
      )}
    >
      {children}
    </p>
  );
}

function SummaryMetricsGrid({
  summary,
  trades,
  tradesLoading,
  currency,
  fxRate = 1,
  equity,
  equityLoading,
}: {
  summary: Summary;
  trades: Trade[];
  tradesLoading?: boolean;
  currency: string;
  fxRate?: number;
  equity?: EquityCurve;
  equityLoading?: boolean;
}) {
  usePrivacyMode();
  const locale = intlLocale();
  const equityPoints = equity?.points ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="grid auto-rows-[minmax(64px,auto)] grid-cols-1 gap-3">
        {/* Equity — top full-bleed, area chart like dashboard */}
        <BentoCell className="min-h-[180px]">
          <BentoTitle tone="muted">
            Equity curve
            {equityPoints.length > 0 && equity
              ? ` · Max DD ${fmtMoney(equity.max_drawdown * fxRate, currency, locale)}`
              : null}
          </BentoTitle>
          <div className="mt-2 min-h-0 flex-1">
            {equityLoading ? (
              <Skeleton height="148px" />
            ) : equityPoints.length > 0 ? (
              <ChartFrame inset className="rounded-none border-0 bg-transparent">
                <ResponsiveContainer width="100%" height={148}>
                  <AreaChart
                    data={equityPoints.map((p) => ({ ...p, equity: p.equity * fxRate }))}
                    margin={{ top: 8, right: 8, bottom: 0, left: 4 }}
                    accessibilityLayer={false}
                  >
                    <defs>
                      <linearGradient id="reports-eq-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={chartTheme.accentStroke} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={chartTheme.accentStroke} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke={chartTheme.gridColor} />
                    <XAxis
                      dataKey="at"
                      ticks={uniqueDayTicks(equityPoints)}
                      tick={{ fontSize: 10, fill: chartTheme.axisColor }}
                      tickFormatter={(v: string) => fmtDayShort(v, intlLocale())}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={60}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: chartTheme.axisColor }}
                      tickFormatter={(v: number) => fmtMoneyCompact(v, currency, intlLocale())}
                      axisLine={false}
                      tickLine={false}
                      width={52}
                      domain={["auto", "auto"]}
                    />
                    <Tooltip
                      contentStyle={{
                        background: chartTheme.tooltipBg,
                        border: `1px solid ${chartTheme.tooltipBorder}`,
                        color: chartTheme.tooltipText,
                        fontSize: 11,
                        borderRadius: "var(--radius-sharp)",
                      }}
                      labelFormatter={(label) => String(label ?? "").slice(0, 10)}
                      formatter={(value) => [
                        fmtMoney(Number(value ?? 0), currency, intlLocale()),
                        "Equity",
                      ]}
                      cursor={{ fill: chartTheme.cursorFill }}
                    />
                    <Area
                      type="monotone"
                      dataKey="equity"
                      stroke={chartTheme.accentStroke}
                      strokeWidth={1.5}
                      fill="url(#reports-eq-fill)"
                      dot={false}
                      activeDot={{ r: 3, fill: chartTheme.accentStroke }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartFrame>
            ) : (
              <p className="py-8 text-center text-[12px] text-text-muted">No equity data yet.</p>
            )}
          </div>
        </BentoCell>
      </div>

      <ReportsDayStrip
        trades={trades}
        loading={tradesLoading}
        currency={currency}
        fxRate={fxRate}
      />

      <ReportsSummaryBento
        summary={summary}
        trades={trades}
        currency={currency}
        fxRate={fxRate}
        equity={equity}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table columns
// ---------------------------------------------------------------------------

export function buildColumns(
  currency: string,
  dimLabel: string,
  fxRate = 1,
): ColumnDef<BreakGroup>[] {
  return [
    {
      accessorKey: "key",
      header: dimLabel,
      cell: (info) => (
        <span style={{ color: "var(--color-text)", fontWeight: 600 }}>
          {info.getValue<string>()}
        </span>
      ),
    },
    {
      id: "total_trades",
      accessorFn: (row) => row.summary.total_trades,
      header: "Trades",
      cell: (info) => (
        <span className="tabular-nums" style={{ color: "var(--color-text-muted)" }}>
          {info.getValue<number>()}
        </span>
      ),
    },
    {
      id: "win_rate",
      accessorFn: (row) => row.summary.win_rate,
      header: "Win Rate",
      cell: (info) => (
        <span className="tabular-nums" style={{ color: "var(--color-text)" }}>
          {fmtPct(info.getValue<number>(), intlLocale())}
        </span>
      ),
    },
    {
      id: "net_pnl",
      accessorFn: (row) => row.summary.net_pnl,
      header: "Net P&L",
      cell: (info) => {
        const v = info.getValue<number>();
        return <ReportsMoneyCell value={v} currency={currency} fxRate={fxRate} />;
      },
    },
    {
      id: "profit_factor",
      accessorFn: (row) => row.summary.profit_factor,
      header: "Profit Factor",
      cell: (info) => {
        const v = info.getValue<number>();
        return (
          <span className="tabular-nums" style={{ color: "var(--color-text)" }}>
            {v > 0 ? v.toFixed(2) : "-"}
          </span>
        );
      },
    },
    {
      id: "expectancy",
      accessorFn: (row) => row.summary.expectancy,
      header: "Expectancy",
      cell: (info) => {
        const v = info.getValue<number>();
        return <ReportsMoneyCell value={v} currency={currency} fxRate={fxRate} />;
      },
    },
  ];
}

function ReportsMoneyCell({
  value,
  currency,
  fxRate = 1,
}: {
  value: number;
  currency: string;
  fxRate?: number;
}) {
  usePrivacyMode();
  return (
    <span className={`tabular-nums ${pnlColor(value)}`}>
      {fmtSignedMoney(value * fxRate, currency, intlLocale())}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Dimension selector
// ---------------------------------------------------------------------------

function DimSelector({
  value,
  onChange,
}: {
  value: BreakdownDim;
  onChange: (d: BreakdownDim) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {SELECTOR_DIMS.map((d) => {
        const active = d === value;
        return (
          <Button
            key={d}
            type="button"
            variant={active ? "soft" : "outline"}
            size="xs"
            onClick={() => onChange(d)}
            className={active ? "font-semibold" : undefined}
          >
            {DIM_LABELS[d]}
          </Button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bar chart
// ---------------------------------------------------------------------------

interface PnlBarChartProps {
  data: BreakGroup[];
  currency: string;
  fxRate?: number;
}

function PnlBarChart({ data, currency, fxRate = 1 }: PnlBarChartProps) {
  usePrivacyMode();
  const chartData = data.map((g) => ({
    key: g.key,
    net_pnl: g.summary.net_pnl * fxRate,
  }));

  return (
    <ChartFrame className="border-0 rounded-none">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={chartTheme.gridColor} />
          <XAxis
            dataKey="key"
            tick={{ fontSize: 10, fill: chartTheme.axisColor }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: chartTheme.axisColor }}
            tickFormatter={(v: number) => fmtSignedMoney(v, currency, intlLocale())}
            axisLine={false}
            tickLine={false}
            width={72}
          />
          <Tooltip
            contentStyle={{
              background: chartTheme.tooltipBg,
              border: `1px solid ${chartTheme.tooltipBorder}`,
              color: chartTheme.tooltipText,
              fontSize: 11,
            }}
            formatter={(value) => [
              fmtSignedMoney(Number(value ?? 0), currency, intlLocale()),
              "Net P&L",
            ]}
            cursor={{ fill: chartTheme.cursorFill }}
          />
          <Bar dataKey="net_pnl" radius={[2, 2, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.net_pnl >= 0 ? POS_COLOR : NEG_COLOR}
                fillOpacity={0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function ReportsView({
  summary,
  summaryLoading,
  summaryError,
  rSummary,
  rSummaryLoading,
  rSummaryError,
  trades,
  tradesLoading,
  tradesError,
  equity,
  equityLoading,
  equityError,
  breakdown,
  loading,
  error,
  dayOfWeekBreakdown,
  dayOfWeekBreakdownLoading,
  dayOfWeekBreakdownError,
  hourOfDayBreakdown,
  hourOfDayBreakdownLoading,
  hourOfDayBreakdownError,
  symbolBreakdown,
  symbolBreakdownLoading,
  symbolBreakdownError,
  tagBreakdown,
  tagBreakdownLoading,
  tagBreakdownError,
  sessionBreakdown,
  sessionBreakdownLoading,
  sessionBreakdownError,
  qualityBreakdown,
  qualityBreakdownLoading,
  qualityBreakdownError,
  tab,
  onTabChange,
  currency,
  dim,
  onDimChange,
}: ReportsViewProps) {
  usePrivacyMode();
  const { currency: displayCurrency, rate } = useMoneyFx(currency);
  const fxRate = rate ?? 1;
  const columns = buildColumns(displayCurrency, DIM_LABELS[dim], fxRate);

  const panelRight = <DimSelector value={dim} onChange={onDimChange} />;

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col gap-3 p-4">
          <Skeleton height="200px" />
          <Skeleton height="160px" />
        </div>
      );
    }

    if (error) {
      return <p className="p-4 text-xs text-loss">Failed to load breakdown data.</p>;
    }

    if (breakdown.length === 0) {
      return <EmptyState title="No data" hint="Add trades or adjust filters to see a breakdown." />;
    }

    return (
      <>
        <PnlBarChart data={breakdown} currency={displayCurrency} fxRate={fxRate} />

        <div style={{ maxHeight: 360 }}>
          <DataTable columns={columns} data={breakdown} />
        </div>
      </>
    );
  };

  return (
    <Page>
      <Tabs
        className="flex flex-col gap-4"
        value={tab}
        onValueChange={(v) => onTabChange(v as ReportsTab)}
      >
        <TabsList
          aria-label="Report sections"
          fullWidth
          className="h-10 rounded-control border-none bg-bg-input p-1"
        >
          <TabsIndicator className="rounded-control bg-bg-input-hover" />
          {REPORT_TABS.map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              fullWidth
              className="h-full px-3 text-[12px] font-medium text-text-dim hover:text-text-muted data-active:text-text"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="flex flex-col gap-4">
          {summaryLoading ? (
            <Skeleton height="120px" />
          ) : summaryError ? (
            <p className="p-4 text-xs text-loss">Failed to load summary.</p>
          ) : summary ? (
            <SummaryMetricsGrid
              summary={summary}
              trades={trades}
              tradesLoading={tradesLoading}
              currency={displayCurrency}
              fxRate={fxRate}
              equity={equity}
              equityLoading={equityLoading}
            />
          ) : null}

          <Card title="Playbook & Leaks" action={panelRight}>
            {renderContent()}
          </Card>

          <ReportsRMultiplePerformance
            rSummary={rSummary}
            loading={Boolean(rSummaryLoading)}
            error={Boolean(rSummaryError)}
          />

          <ReportsExecutionGrade
            breakdown={qualityBreakdown}
            loading={qualityBreakdownLoading}
            error={qualityBreakdownError}
            currency={displayCurrency}
            fxRate={fxRate}
          />
        </TabsContent>

        <TabsContent value="win-loss" className="flex flex-col gap-4">
          <ReportsRollingWinRate trades={trades} loading={tradesLoading} error={tradesError} />

          <ReportsMetricEvolution
            trades={trades}
            loading={tradesLoading}
            error={tradesError}
            currency={displayCurrency}
            fxRate={fxRate}
          />
        </TabsContent>

        <TabsContent value="detailed" className="flex flex-col gap-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <ReportsBreakdownCard
              title="Symbol"
              breakdown={symbolBreakdown}
              loading={symbolBreakdownLoading}
              error={symbolBreakdownError}
              currency={displayCurrency}
              fxRate={fxRate}
              orientation="horizontal"
              tableColumns={buildColumns(displayCurrency, "Symbol", fxRate)}
            />
            <ReportsBreakdownCard
              title="Tag"
              breakdown={tagBreakdown}
              loading={tagBreakdownLoading}
              error={tagBreakdownError}
              currency={displayCurrency}
              fxRate={fxRate}
              orientation="horizontal"
              tableColumns={buildColumns(displayCurrency, "Tag", fxRate)}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ReportsBreakdownCard
              title="Day of Week"
              breakdown={dayOfWeekBreakdown}
              loading={dayOfWeekBreakdownLoading}
              error={dayOfWeekBreakdownError}
              currency={displayCurrency}
              fxRate={fxRate}
              tableColumns={buildColumns(displayCurrency, "Day", fxRate)}
            />
            <ReportsHourlyList
              breakdown={hourOfDayBreakdown}
              loading={hourOfDayBreakdownLoading}
              error={hourOfDayBreakdownError}
              currency={displayCurrency}
              fxRate={fxRate}
            />
          </div>

          <ReportsSessionTable
            breakdown={sessionBreakdown}
            loading={sessionBreakdownLoading}
            error={sessionBreakdownError}
            currency={displayCurrency}
            fxRate={fxRate}
          />

          <ReportsSymbolHeatmap
            breakdown={symbolBreakdown}
            loading={symbolBreakdownLoading}
            error={symbolBreakdownError}
            currency={displayCurrency}
            fxRate={fxRate}
          />
        </TabsContent>

        <TabsContent value="risk" className="flex flex-col gap-4">
          <ReportsRiskDrawdown
            trades={trades}
            equityPoints={equity?.points ?? []}
            loading={tradesLoading || equityLoading}
            error={tradesError || equityError}
            currency={displayCurrency}
            fxRate={fxRate}
          />
        </TabsContent>
      </Tabs>
    </Page>
  );
}
