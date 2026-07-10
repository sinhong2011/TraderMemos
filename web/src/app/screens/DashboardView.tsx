import { ChevronRight, TrendingUp } from "lucide-react";
import { useState } from "react";
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
import { SegmentedControl } from "../../components/SegmentedControl";
import { Skeleton } from "../../components/Skeleton";
import { StatBar } from "../../components/StatBar";
import { pnlColor } from "../../components/theme-tokens";
import { tradeColumns } from "../../components/tradeColumns";
import type { Account, EquityPoint, Summary, Trade } from "../../lib/api/types";
import { cn } from "../../lib/cn";
import { fmtMoney, fmtPct, fmtSignedMoney } from "../../lib/format";
import type { TradeStatusFilter } from "../../lib/tradeFilters";

const labelClass =
	"font-mono text-[10px] font-medium uppercase tracking-widest text-text-dim";

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
}

const LOCALE = "en-US";
const RANGES = [
	{ value: "30D", label: "30D" },
	{ value: "90D", label: "90D" },
	{ value: "ALL", label: "ALL" },
];

function getCurrency(accounts: Account[], accountId?: string): string {
	if (!accountId) return "USD";
	return accounts.find((a) => a.id === accountId)?.base_currency ?? "USD";
}

function startingBalance(accounts: Account[], accountId?: string): number {
	const list = accountId
		? accounts.filter((a) => a.id === accountId)
		: accounts;
	return list.reduce((s, a) => s + a.starting_balance, 0);
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
	starting,
	tradeStatusFilter,
	onToggleTradeStatus,
}: {
	summary: Summary;
	trades: Trade[];
	currency: string;
	starting: number;
	tradeStatusFilter?: TradeStatusFilter;
	onToggleTradeStatus?: (filter: TradeStatusFilter) => void;
}) {
	const [pnlExpanded, setPnlExpanded] = useState(false);
	const total = Math.max(summary.total_trades, 1);
	const allTotal = Math.max(trades.length, 1);
	const openCount = trades.filter((t) => t.status === "open").length;
	const pnlPct = starting > 0 ? summary.net_pnl / starting : null;
	const avgWinPct = starting > 0 ? summary.avg_win / starting : 0;
	const avgLossPct = starting > 0 ? Math.abs(summary.avg_loss) / starting : 0;

	const toggle = (f: TradeStatusFilter) => onToggleTradeStatus?.(f);

	return (
		<div className="flex flex-wrap items-end gap-3 border-b border-border bg-bg-panel px-4 py-3">
			<StatBar
				label="WINS"
				value={String(summary.wins)}
				right={fmtPct(summary.win_rate, LOCALE)}
				pct={summary.wins / total}
				tone="pos"
				active={tradeStatusFilter === "win"}
				onClick={toggle ? () => toggle("win") : undefined}
			/>
			<StatBar
				label="LOSSES"
				value={String(summary.losses)}
				right={fmtPct(summary.losses / total, LOCALE)}
				pct={summary.losses / total}
				tone="neg"
				active={tradeStatusFilter === "loss"}
				onClick={toggle ? () => toggle("loss") : undefined}
			/>
			<StatBar
				label="OPEN"
				value={String(openCount)}
				right={fmtPct(openCount / allTotal, LOCALE)}
				pct={openCount / allTotal}
				tone="accent"
				active={tradeStatusFilter === "open"}
				onClick={toggle ? () => toggle("open") : undefined}
			/>
			<StatBar
				label="WASH"
				value={String(summary.breakeven)}
				right={fmtPct(summary.breakeven / total, LOCALE)}
				pct={summary.breakeven / total}
				tone="amber"
				active={tradeStatusFilter === "wash"}
				onClick={toggle ? () => toggle("wash") : undefined}
			/>
			<StatBar
				label="AVG W"
				value={fmtMoney(summary.avg_win, currency, LOCALE)}
				right={starting > 0 ? fmtPct(avgWinPct, LOCALE) : undefined}
				pct={avgWinPct}
				tone="pos"
			/>
			<StatBar
				label="AVG L"
				value={fmtMoney(summary.avg_loss, currency, LOCALE)}
				right={starting > 0 ? fmtPct(avgLossPct, LOCALE) : undefined}
				pct={avgLossPct}
				tone="neg"
			/>

			<div className="ml-auto flex min-w-[140px] flex-col gap-1">
				<button
					type="button"
					onClick={() => setPnlExpanded((v) => !v)}
					className="flex cursor-pointer items-end justify-between gap-2 rounded-control border border-transparent px-2 py-1.5 text-left transition-colors hover:bg-bg-hover"
					aria-expanded={pnlExpanded}
				>
					<div>
						<div className={cn(labelClass, "mb-1")}>PnL</div>
						<div
							className={cn(
								"font-mono text-xl font-semibold tracking-tight tabular-nums",
								pnlColor(summary.net_pnl),
							)}
						>
							{fmtSignedMoney(summary.net_pnl, currency, LOCALE)}
						</div>
					</div>
					<div className="flex items-center gap-1">
						{pnlPct != null && (
							<span
								className={cn("text-xs tabular-nums", pnlColor(summary.net_pnl))}
							>
								{(pnlPct * 100).toFixed(2)}%
							</span>
						)}
						<ChevronRight
							size={14}
							className={cn(
								"text-text-dim transition-transform",
								pnlExpanded && "rotate-90",
							)}
						/>
					</div>
				</button>
				{pnlExpanded && (
					<div className="px-2 font-mono text-[10px] text-text-muted">
						Gross {fmtSignedMoney(summary.gross_profit + summary.gross_loss, currency, LOCALE)}
						{" · "}
						Fees {fmtMoney(summary.total_fees, currency, LOCALE)}
					</div>
				)}
			</div>
		</div>
	);
}

function DashboardBento({
	summaryLoading,
	summaryError,
	summary,
	trades,
	equityLoading,
	equityError,
	equityPoints,
	currency,
	starting,
	range,
	onRangeChange,
	tradeStatusFilter,
	onToggleTradeStatus,
}: {
	summaryLoading: boolean;
	summaryError: boolean;
	summary: Summary | undefined;
	trades: Trade[];
	equityLoading: boolean;
	equityError: boolean;
	equityPoints: EquityPoint[];
	currency: string;
	starting: number;
	range: string;
	onRangeChange: (r: string) => void;
	tradeStatusFilter?: TradeStatusFilter;
	onToggleTradeStatus?: (filter: TradeStatusFilter) => void;
}) {
	const cutoff = rangeCutoff(range);
	const visible = cutoff
		? equityPoints.filter((p) => new Date(p.at).getTime() >= cutoff)
		: equityPoints;

	if (summaryLoading) {
		return <Skeleton height="220px" />;
	}
	if (summaryError) {
		return (
			<p className="p-4 text-xs text-loss">Failed to load summary.</p>
		);
	}
	if (!summary) return null;

	return (
		<div className="flex flex-col border-b border-border">
			<div className="flex min-h-[200px] flex-col justify-between bg-bg-panel px-4 py-3.5">
				<div className="flex items-center justify-between gap-3">
					<span className={labelClass}>Equity curve</span>
					<SegmentedControl
						ariaLabel="Equity range"
						options={RANGES}
						value={range}
						onChange={onRangeChange}
					/>
				</div>
				{equityLoading ? (
					<Skeleton height="120px" />
				) : equityError ? (
					<p className="text-xs text-loss">Failed to load equity curve.</p>
				) : visible.length === 0 ? (
					<EmptyState title="No equity data" />
				) : (
					<ChartFrame className="border-0 rounded-none mt-2">
						<ResponsiveContainer width="100%" height={120}>
							<AreaChart
								data={visible}
								margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
							>
								<defs>
									<linearGradient id="eq-fill" x1="0" y1="0" x2="0" y2="1">
										<stop
											offset="5%"
											stopColor={chartTheme.accentStroke}
											stopOpacity={0.25}
										/>
										<stop
											offset="95%"
											stopColor={chartTheme.accentStroke}
											stopOpacity={0}
										/>
									</linearGradient>
								</defs>
								<CartesianGrid vertical={false} stroke={chartTheme.gridColor} />
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
									tickFormatter={(v: number) => fmtMoney(v, currency, LOCALE)}
									axisLine={false}
									tickLine={false}
									width={64}
									domain={["auto", "auto"]}
								/>
								<Tooltip
									contentStyle={{
										background: chartTheme.tooltipBg,
										border: `1px solid ${chartTheme.tooltipBorder}`,
										color: chartTheme.tooltipText,
										fontSize: 11,
										fontFamily: "var(--font-mono)",
										borderRadius: "var(--radius-sharp)",
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
									stroke={chartTheme.accentStroke}
									strokeWidth={1.5}
									fill="url(#eq-fill)"
									dot={false}
									activeDot={{ r: 3, fill: chartTheme.accentStroke }}
								/>
							</AreaChart>
						</ResponsiveContainer>
					</ChartFrame>
				)}
			</div>

			<StatsStrip
				summary={summary}
				trades={trades}
				currency={currency}
				starting={starting}
				tradeStatusFilter={tradeStatusFilter}
				onToggleTradeStatus={onToggleTradeStatus}
			/>
		</div>
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
}: DashboardViewProps) {
	const currency = getCurrency(accounts, selectedAccountId);
	const starting = startingBalance(accounts, selectedAccountId);
	const [range, setRange] = useState("30D");

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
					hint="Import a CSV or log a trade to get started."
					icon={<TrendingUp size={40} strokeWidth={1.5} />}
				/>
			</div>
		);
	}

	return (
		<div className="flex flex-col">
			<DashboardBento
				summaryLoading={summaryLoading}
				summaryError={summaryError}
				summary={summary}
				trades={trades}
				equityLoading={equityLoading}
				equityError={equityError}
				equityPoints={equityPoints}
				currency={currency}
				starting={starting}
				range={range}
				onRangeChange={setRange}
				tradeStatusFilter={tradeStatusFilter}
				onToggleTradeStatus={onToggleTradeStatus}
			/>

			<Panel className="border-t-0 rounded-none">
				{tradesLoading ? (
					<Skeleton height="240px" className="m-3" />
				) : tradesError ? (
					<p className="p-4 text-xs text-loss">Failed to load trades.</p>
				) : trades.length === 0 ? (
					<EmptyState
						title={
							tradeStatusFilter
								? "No trades match this filter"
								: "No trades in this range"
						}
						hint={
							tradeStatusFilter
								? "Click the stat chip again to clear the filter."
								: undefined
						}
					/>
				) : (
					<>
						<div className="max-h-[520px]">
							<DataTable
								columns={tradeColumns(currency, onSelectTrade)}
								data={trades}
								onRowClick={onSelectTrade}
							/>
						</div>
						<p className="py-3 text-center text-xs text-text-muted">
							All {trades.length} trades loaded
						</p>
					</>
				)}
			</Panel>
		</div>
	);
}
