import type { ColumnDef } from "@tanstack/react-table";
import { TrendingUp } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartFrame, chartTheme } from "../../components/ChartFrame";
import { DataTable } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import { Panel } from "../../components/Panel";
import { Skeleton } from "../../components/Skeleton";
import { StatCard } from "../../components/StatCard";
import { pnlColor } from "../../components/theme-tokens";
import { monthGrid } from "../../lib/calendar";
import { fmtMoney, fmtPct, fmtSignedMoney } from "../../lib/format";
import type {
  Account,
  EquityPoint,
  Summary,
  Trade,
} from "../../lib/api/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DashboardViewProps {
  // Query states
  summaryLoading: boolean;
  summaryError: boolean;
  summary: Summary | undefined;

  equityLoading: boolean;
  equityError: boolean;
  equityPoints: EquityPoint[];

  dailyLoading: boolean;
  dailyError: boolean;
  dailyPnl: Record<string, number>;

  tradesLoading: boolean;
  tradesError: boolean;
  trades: Trade[];

  accounts: Account[];
  selectedAccountId: string | undefined;

  // For the mini-calendar: which month to show
  year: number;
  month: number; // 1-based
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCurrency(accounts: Account[], accountId?: string): string {
  if (!accountId) return "USD";
  return accounts.find((a) => a.id === accountId)?.base_currency ?? "USD";
}

const LOCALE = "en-US";

const DOW_HEADERS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// ---------------------------------------------------------------------------
// Sub-sections
// ---------------------------------------------------------------------------

function KpiRow({
  loading,
  error,
  summary,
  currency,
}: {
  loading: boolean;
  error: boolean;
  summary: Summary | undefined;
  currency: string;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} height="64px" />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <p className="text-xs" style={{ color: "var(--color-neg)" }}>
        Failed to load summary.
      </p>
    );
  }
  if (!summary) return null;

  const pnlAccent: "pos" | "neg" | "none" =
    summary.net_pnl > 0 ? "pos" : summary.net_pnl < 0 ? "neg" : "none";

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <StatCard
        label="Net P&L"
        value={fmtSignedMoney(summary.net_pnl, currency, LOCALE)}
        accent={pnlAccent}
      />
      <StatCard
        label="Win Rate"
        value={fmtPct(summary.win_rate, LOCALE)}
      />
      <StatCard
        label="Profit Factor"
        value={
          summary.profit_factor === 0
            ? "-"
            : summary.profit_factor.toFixed(2)
        }
      />
      <StatCard
        label="Expectancy"
        value={fmtSignedMoney(summary.expectancy, currency, LOCALE)}
      />
      <StatCard
        label="Trades"
        value={String(summary.total_trades)}
        hint={`avg win ${fmtMoney(summary.avg_win, currency, LOCALE)}`}
      />
    </div>
  );
}

function EquityCurvePanel({
  loading,
  error,
  points,
  currency,
}: {
  loading: boolean;
  error: boolean;
  points: EquityPoint[];
  currency: string;
}) {
  const content = () => {
    if (loading) return <Skeleton height="200px" className="m-3" />;
    if (error)
      return (
        <p className="p-4 text-xs" style={{ color: "var(--color-neg)" }}>
          Failed to load equity curve.
        </p>
      );
    if (points.length === 0)
      return (
        <EmptyState
          title="No equity data"
          hint="Add trades to see your equity curve."
        />
      );
    return (
      <ChartFrame className="border-0 rounded-none">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart
            data={points}
            margin={{ top: 12, right: 12, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient id="eq-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#34d399" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke={chartTheme.gridColor}
            />
            <XAxis
              dataKey="at"
              tick={{ fontSize: 10, fill: chartTheme.axisColor }}
              tickFormatter={(v: string) => v.slice(0, 10)}
              axisLine={false}
              tickLine={false}
              minTickGap={60}
            />
            <YAxis
              tick={{ fontSize: 10, fill: chartTheme.axisColor }}
              tickFormatter={(v: number) =>
                fmtMoney(v, currency, LOCALE)
              }
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
                fontFamily: "var(--font-mono)",
              }}
              labelFormatter={(label: string) => label.slice(0, 10)}
              formatter={(value: number) => [
                fmtMoney(value, currency, LOCALE),
                "Equity",
              ]}
              cursor={{ fill: chartTheme.cursorFill }}
            />
            <Area
              type="monotone"
              dataKey="equity"
              stroke="#34d399"
              strokeWidth={1.5}
              fill="url(#eq-fill)"
              dot={false}
              activeDot={{ r: 3, fill: "#34d399" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartFrame>
    );
  };

  return <Panel title="Equity Curve">{content()}</Panel>;
}

function MiniCalendar({
  loading,
  error,
  dailyPnl,
  year,
  month,
  currency,
}: {
  loading: boolean;
  error: boolean;
  dailyPnl: Record<string, number>;
  year: number;
  month: number;
  currency: string;
}) {
  const content = () => {
    if (loading) return <Skeleton height="160px" className="m-3" />;
    if (error)
      return (
        <p className="p-4 text-xs" style={{ color: "var(--color-neg)" }}>
          Failed to load daily P&L.
        </p>
      );

    const grid = monthGrid(year, month, dailyPnl);

    return (
      <div className="p-3">
        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 mb-1">
          {DOW_HEADERS.map((d) => (
            <div
              key={d}
              className="text-center text-[10px] font-medium uppercase"
              style={{ color: "var(--color-text-muted)" }}
            >
              {d}
            </div>
          ))}
        </div>
        {/* Weeks */}
        {grid.weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-px">
            {week.map((cell, di) => {
              if (!cell) {
                return <div key={di} className="aspect-square" />;
              }
              const day = Number(cell.date.slice(8, 10));
              const hasPnl = cell.pnl != null;
              const color = hasPnl
                ? cell.pnl! > 0
                  ? "var(--color-pos)"
                  : "var(--color-neg)"
                : "var(--color-text-muted)";
              return (
                <div
                  key={di}
                  className="flex flex-col items-center justify-center aspect-square rounded text-[10px] leading-none"
                  style={{
                    background: hasPnl
                      ? cell.pnl! > 0
                        ? "rgba(52,211,153,0.12)"
                        : "rgba(248,113,113,0.12)"
                      : "transparent",
                    color,
                  }}
                  title={
                    hasPnl
                      ? `${cell.date}: ${fmtSignedMoney(cell.pnl!, currency, LOCALE)}`
                      : cell.date
                  }
                >
                  <span>{day}</span>
                  {hasPnl && (
                    <span
                      className="text-[8px] leading-none mt-0.5 tabular-nums"
                    >
                      {cell.pnl! >= 0 ? "+" : ""}
                      {Math.round(cell.pnl!)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        {/* Month total */}
        <div
          className="mt-2 pt-2 text-xs text-right tabular-nums"
          style={{
            borderTop: "1px solid var(--color-border)",
            color:
              grid.monthTotal > 0
                ? "var(--color-pos)"
                : grid.monthTotal < 0
                  ? "var(--color-neg)"
                  : "var(--color-text-muted)",
          }}
        >
          Month total:{" "}
          {grid.monthTotal !== 0
            ? fmtSignedMoney(grid.monthTotal, currency, LOCALE)
            : "-"}
        </div>
      </div>
    );
  };

  const monthName = new Date(year, month - 1, 1).toLocaleString(LOCALE, {
    month: "long",
    year: "numeric",
  });

  return <Panel title={`This Month - ${monthName}`}>{content()}</Panel>;
}

// Recent trades columns
function recentTradesColumns(currency: string): ColumnDef<Trade>[] {
  return [
    {
      accessorKey: "symbol",
      header: "Symbol",
      cell: (info) => (
        <span style={{ color: "var(--color-text)" }}>
          {info.getValue<string>()}
        </span>
      ),
    },
    {
      accessorKey: "direction",
      header: "Dir",
      cell: (info) => (
        <span
          style={{
            color:
              info.getValue<string>() === "long"
                ? "var(--color-pos)"
                : "var(--color-neg)",
          }}
        >
          {info.getValue<string>().toUpperCase()}
        </span>
      ),
    },
    {
      accessorKey: "closed_at",
      header: "Closed",
      cell: (info) => {
        const v = info.getValue<string | null>();
        return (
          <span style={{ color: "var(--color-text-muted)" }}>
            {v ? v.slice(0, 10) : "-"}
          </span>
        );
      },
    },
    {
      accessorKey: "net_pnl",
      header: "Net P&L",
      cell: (info) => {
        const v = info.getValue<number | null>();
        if (v == null) return <span style={{ color: "var(--color-text-muted)" }}>-</span>;
        return (
          <span className={pnlColor(v)}>
            {fmtSignedMoney(v, currency, LOCALE)}
          </span>
        );
      },
    },
  ];
}

function RecentTradesPanel({
  loading,
  error,
  trades,
  currency,
}: {
  loading: boolean;
  error: boolean;
  trades: Trade[];
  currency: string;
}) {
  const content = () => {
    if (loading) return <Skeleton height="160px" className="m-3" />;
    if (error)
      return (
        <p className="p-4 text-xs" style={{ color: "var(--color-neg)" }}>
          Failed to load trades.
        </p>
      );
    if (trades.length === 0)
      return (
        <EmptyState
          title="No trades yet"
          hint="Import a CSV or add a trade to get started."
          icon={<TrendingUp size={32} strokeWidth={1.5} />}
        />
      );
    return (
      <div style={{ maxHeight: "280px" }}>
        <DataTable
          columns={recentTradesColumns(currency)}
          data={trades}
        />
      </div>
    );
  };

  return <Panel title="Recent Trades">{content()}</Panel>;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function DashboardView({
  summaryLoading,
  summaryError,
  summary,
  equityLoading,
  equityError,
  equityPoints,
  dailyLoading,
  dailyError,
  dailyPnl,
  tradesLoading,
  tradesError,
  trades,
  accounts,
  selectedAccountId,
  year,
  month,
}: DashboardViewProps) {
  const currency = getCurrency(accounts, selectedAccountId);

  // Show overall empty state if not loading and no trades at all
  const noData =
    !summaryLoading &&
    !tradesLoading &&
    !summaryError &&
    !tradesError &&
    summary?.total_trades === 0 &&
    trades.length === 0;

  if (noData) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <EmptyState
          title="No trades yet"
          hint="Import a CSV or add a trade to get started."
          icon={<TrendingUp size={40} strokeWidth={1.5} />}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* KPI row */}
      <KpiRow
        loading={summaryLoading}
        error={summaryError}
        summary={summary}
        currency={currency}
      />

      {/* Middle row: equity curve + mini calendar */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <EquityCurvePanel
            loading={equityLoading}
            error={equityError}
            points={equityPoints}
            currency={currency}
          />
        </div>
        <div>
          <MiniCalendar
            loading={dailyLoading}
            error={dailyError}
            dailyPnl={dailyPnl}
            year={year}
            month={month}
            currency={currency}
          />
        </div>
      </div>

      {/* Recent trades */}
      <RecentTradesPanel
        loading={tradesLoading}
        error={tradesError}
        trades={trades}
        currency={currency}
      />
    </div>
  );
}
