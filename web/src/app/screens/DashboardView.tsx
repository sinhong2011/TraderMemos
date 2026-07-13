import { Plus, TrendingUp, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
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
import { SegmentedControl } from "../../components/SegmentedControl";
import { Skeleton } from "../../components/Skeleton";
import { StatBar } from "../../components/StatBar";
import { tradeColumns } from "../../components/tradeColumns";
import type { Account, EquityPoint, Summary, Trade } from "../../lib/api/types";
import { uniqueDayTicks } from "../../lib/chartTicks";
import { fmtDayShort, fmtMoney, fmtMoneyCompact, fmtPct, fmtSignedMoney } from "../../lib/format";
import { intlLocale } from "../../lib/locale";
import type { TradeStatusFilter } from "../../lib/tradeFilters";

export interface DashboardViewProps {
  summaryLoading: boolean;
  summaryError: boolean;
  summary: Summary | undefined;
  equityLoading: boolean;
  equityError: boolean;
  equityPoints: EquityPoint[];
  tradesLoading: boolean;
  tradesError: boolean;
  trades: Trade[];
  accounts: Account[];
  selectedAccountId: string | undefined;
  tradeStatusFilter?: TradeStatusFilter;
  onToggleTradeStatus?: (filter: TradeStatusFilter) => void;
  onSelectTrade: (t: Trade) => void;
  accountFunded: boolean;
  onImport: () => void;
  onNewTrade: () => void;
}

const RANGES = [
  { value: "30D", label: "30D" },
  { value: "90D", label: "90D" },
  { value: "ALL", label: "ALL" },
];

function getCurrency(accounts: Account[], accountId?: string): string {
  if (!accountId) return "USD";
  return accounts.find((a) => a.id === accountId)?.base_currency ?? "USD";
}

function rangeCutoff(range: string): number | null {
  if (range === "ALL") return null;
  const days = range === "30D" ? 30 : 90;
  return Date.now() - days * 86400_000;
}

function StatsStrip({
  summary,
  trades,
  currency,
  tradeStatusFilter,
  onToggleTradeStatus,
}: {
  summary: Summary;
  trades: Trade[];
  currency: string;
  tradeStatusFilter?: TradeStatusFilter;
  onToggleTradeStatus?: (filter: TradeStatusFilter) => void;
}) {
  const total = Math.max(summary.total_trades, 1);
  const allTotal = Math.max(trades.length, 1);
  const openCount = trades.filter((t) => t.status === "open").length;

  const toggle = (f: TradeStatusFilter) => onToggleTradeStatus?.(f);

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatBar
          label="WINS"
          value={String(summary.wins)}
          sub={fmtPct(summary.win_rate, intlLocale())}
          tone="pos"
          active={tradeStatusFilter === "win"}
          onClick={toggle ? () => toggle("win") : undefined}
        />
        <StatBar
          label="LOSSES"
          value={String(summary.losses)}
          sub={fmtPct(summary.losses / total, intlLocale())}
          tone="neg"
          active={tradeStatusFilter === "loss"}
          onClick={toggle ? () => toggle("loss") : undefined}
        />
        <StatBar
          label="OPEN"
          value={String(openCount)}
          sub={fmtPct(openCount / allTotal, intlLocale())}
          tone="accent"
          active={tradeStatusFilter === "open"}
          onClick={toggle ? () => toggle("open") : undefined}
        />
        <StatBar
          label="WASH"
          value={String(summary.breakeven)}
          sub={fmtPct(summary.breakeven / total, intlLocale())}
          tone="amber"
          active={tradeStatusFilter === "wash"}
          onClick={toggle ? () => toggle("wash") : undefined}
        />
        <StatBar
          label="AVG W"
          value={fmtMoney(summary.avg_win, currency, intlLocale())}
          tone="pos"
        />
        <StatBar
          label="AVG L"
          value={fmtMoney(summary.avg_loss, currency, intlLocale())}
          tone="neg"
        />
      </div>
      <p className="m-0 px-4 py-1.5 text-[10px] tabular-nums text-text-dim">
        Gross {fmtSignedMoney(summary.gross_profit + summary.gross_loss, currency, intlLocale())}
        <span className="text-text-dim/60"> · </span>
        Fees {fmtMoney(summary.total_fees, currency, intlLocale())}
      </p>
    </>
  );
}

function EquityCurveChart({
  equityLoading,
  equityError,
  equityPoints,
  currency,
  range,
}: {
  equityLoading: boolean;
  equityError: boolean;
  equityPoints: EquityPoint[];
  currency: string;
  range: string;
}) {
  const cutoff = rangeCutoff(range);
  const visible = useMemo(
    () => (cutoff ? equityPoints.filter((p) => new Date(p.at).getTime() >= cutoff) : equityPoints),
    [cutoff, equityPoints],
  );
  const dayTicks = useMemo(() => uniqueDayTicks(visible), [visible]);

  if (equityLoading) {
    return <Skeleton height="120px" />;
  }
  if (equityError) {
    return <p className="text-xs text-loss">Failed to load equity curve.</p>;
  }
  if (visible.length === 0) {
    return <EmptyState title="No equity data" />;
  }

  return (
    <ChartFrame inset className="rounded-none border-0 bg-transparent">
      <ResponsiveContainer width="100%" height={120}>
        <AreaChart data={visible} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id="eq-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={chartTheme.accentStroke} stopOpacity={0.25} />
              <stop offset="95%" stopColor={chartTheme.accentStroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={chartTheme.gridColor} />
          <XAxis
            dataKey="at"
            ticks={dayTicks}
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
            formatter={(value) => [fmtMoney(Number(value ?? 0), currency, intlLocale()), "Equity"]}
            cursor={{ fill: chartTheme.cursorFill }}
          />
          <Area
            type="monotone"
            dataKey="equity"
            stroke={chartTheme.accentStroke}
            strokeWidth={1.5}
            fill="url(#eq-fill)"
            dot={false}
            activeDot={{ r: 3, fill: chartTheme.accentStroke }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function DashboardView({
  summaryLoading,
  summaryError,
  summary,
  equityLoading,
  equityError,
  equityPoints,
  tradesLoading,
  tradesError,
  trades,
  accounts,
  selectedAccountId,
  tradeStatusFilter,
  onToggleTradeStatus,
  onSelectTrade,
  accountFunded,
  onImport,
  onNewTrade,
}: DashboardViewProps) {
  const currency = getCurrency(accounts, selectedAccountId);
  const [range, setRange] = useState("30D");

  const noData =
    !summaryLoading &&
    !tradesLoading &&
    !summaryError &&
    !tradesError &&
    summary?.total_trades === 0 &&
    trades.length === 0;

  if (noData) {
    const emptyActions = (
      <>
        <button
          type="button"
          onClick={onImport}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-control border-none bg-accent px-3 py-1.5 text-[12px] font-semibold text-bg transition-opacity hover:opacity-90"
        >
          <Upload size={13} strokeWidth={1.75} />
          Import CSV
        </button>
        <button
          type="button"
          onClick={onNewTrade}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-control border border-border bg-bg-inset px-3 py-1.5 text-[12px] text-text-muted transition-colors hover:border-border-strong hover:bg-bg-hover hover:text-text"
        >
          <Plus size={13} strokeWidth={1.75} />
          Log trade
        </button>
      </>
    );

    return (
      <Page fill className="items-center justify-center">
        <EmptyState
          title="No trades yet"
          hint={
            accountFunded
              ? "Account funded — import history or log your first trade to see P&L light up here."
              : "Import broker history or log your first trade to start tracking performance."
          }
          icon={<TrendingUp size={40} strokeWidth={1.5} />}
          actions={emptyActions}
        />
      </Page>
    );
  }

  return (
    <Page fill className="min-h-[calc(100dvh-52px)]">
      <Card
        title="Equity curve"
        action={
          <SegmentedControl
            ariaLabel="Equity range"
            options={RANGES}
            value={range}
            onChange={setRange}
          />
        }
      >
        {summaryLoading ? (
          <Skeleton height="120px" />
        ) : summaryError ? (
          <p className="text-xs text-loss">Failed to load summary.</p>
        ) : !summary ? null : (
          <EquityCurveChart
            equityLoading={equityLoading}
            equityError={equityError}
            equityPoints={equityPoints}
            currency={currency}
            range={range}
          />
        )}
      </Card>

      {summary && !summaryLoading && !summaryError ? (
        <Card title="Performance" flush>
          <StatsStrip
            summary={summary}
            trades={trades}
            currency={currency}
            tradeStatusFilter={tradeStatusFilter}
            onToggleTradeStatus={onToggleTradeStatus}
          />
        </Card>
      ) : null}

      <Card title="Trades" fill flush className="min-h-0">
        {tradesLoading ? (
          <Skeleton height="240px" className="m-3" />
        ) : tradesError ? (
          <p className="p-4 text-xs text-loss">Failed to load trades.</p>
        ) : trades.length === 0 ? (
          <EmptyState
            title={tradeStatusFilter ? "No trades match this filter" : "No trades in this range"}
            hint={tradeStatusFilter ? "Click the stat chip again to clear the filter." : undefined}
          />
        ) : (
          <>
            <div className="min-h-0 flex-1">
              <DataTable
                columns={tradeColumns(currency, onSelectTrade)}
                data={trades}
                onRowClick={onSelectTrade}
                maxHeight="100%"
                className="h-full"
              />
            </div>
            <p className="shrink-0 py-2 text-center text-xs text-text-muted">
              All {trades.length} trades loaded
            </p>
          </>
        )}
      </Card>
    </Page>
  );
}
