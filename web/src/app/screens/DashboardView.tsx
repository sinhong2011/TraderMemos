import { TrendingUp } from "lucide-react";
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
import { fmtMoney, fmtPct, fmtSignedMoney } from "../../lib/format";

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

function EquityBand({
	loading,
	error,
	points,
	currency,
	range,
	onRangeChange,
}: {
	loading: boolean;
	error: boolean;
	points: EquityPoint[];
	currency: string;
	range: string;
	onRangeChange: (r: string) => void;
}) {
	const cutoff = rangeCutoff(range);
	const visible = cutoff
		? points.filter((p) => new Date(p.at).getTime() >= cutoff)
		: points;

	return (
		<Panel>
			<div className="flex items-center justify-between px-3 pt-2">
				<SegmentedControl
					ariaLabel="Equity range"
					options={RANGES}
					value={range}
					onChange={onRangeChange}
				/>
			</div>
			{loading ? (
				<Skeleton height="150px" className="m-3" />
			) : error ? (
				<p className="p-4 text-xs" style={{ color: "var(--color-neg)" }}>
					Failed to load equity curve.
				</p>
			) : visible.length === 0 ? (
				<EmptyState title="No equity data" />
			) : (
				<ChartFrame className="border-0 rounded-none">
					<ResponsiveContainer width="100%" height={150}>
						<AreaChart
							data={visible}
							margin={{ top: 10, right: 12, bottom: 0, left: 0 }}
						>
							<defs>
								<linearGradient id="eq-fill" x1="0" y1="0" x2="0" y2="1">
									<stop offset="5%" stopColor="#6ea8fe" stopOpacity={0.2} />
									<stop offset="95%" stopColor="#6ea8fe" stopOpacity={0} />
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
								stroke="#6ea8fe"
								strokeWidth={1.5}
								fill="url(#eq-fill)"
								dot={false}
								activeDot={{ r: 3, fill: "#6ea8fe" }}
							/>
						</AreaChart>
					</ResponsiveContainer>
				</ChartFrame>
			)}
		</Panel>
	);
}

function StatsStrip({
	loading,
	error,
	summary,
	trades,
	currency,
	starting,
}: {
	loading: boolean;
	error: boolean;
	summary: Summary | undefined;
	trades: Trade[];
	currency: string;
	starting: number;
}) {
	if (loading) return <Skeleton height="150px" />;
	if (error)
		return (
			<p className="text-xs p-4" style={{ color: "var(--color-neg)" }}>
				Failed to load summary.
			</p>
		);
	if (!summary) return null;

	const total = Math.max(summary.total_trades, 1);
	// OPEN is a share of all trades in scope; WINS/LOSSES/WASH are shares of
	// closed trades (summary.total_trades) so they stay consistent with win_rate.
	const allTotal = Math.max(trades.length, 1);
	const openCount = trades.filter((t) => t.status === "open").length;
	const avgWinAbs = Math.abs(summary.avg_win);
	const avgLossAbs = Math.abs(summary.avg_loss);
	const avgDen = avgWinAbs + avgLossAbs || 1;
	const pnlPct = starting > 0 ? summary.net_pnl / starting : null;

	return (
		<Panel>
			<div className="flex items-center gap-6 flex-wrap p-4">
				<div className="flex flex-col gap-3 flex-1" style={{ minWidth: 130 }}>
					<StatBar
						label="WINS"
						value={String(summary.wins)}
						right={fmtPct(summary.win_rate, LOCALE)}
						pct={summary.win_rate}
						tone="pos"
					/>
					<StatBar
						label="LOSSES"
						value={String(summary.losses)}
						right={fmtPct(summary.losses / total, LOCALE)}
						pct={summary.losses / total}
						tone="neg"
					/>
				</div>
				<div className="flex flex-col gap-3 flex-1" style={{ minWidth: 130 }}>
					<StatBar
						label="OPEN"
						value={String(openCount)}
						right={fmtPct(openCount / allTotal, LOCALE)}
						pct={openCount / allTotal}
						tone="accent"
					/>
					<StatBar
						label="WASH"
						value={String(summary.breakeven)}
						right={fmtPct(summary.breakeven / total, LOCALE)}
						pct={summary.breakeven / total}
						tone="amber"
					/>
				</div>
				<div className="flex flex-col gap-3 flex-1" style={{ minWidth: 150 }}>
					<StatBar
						label="AVG W"
						value={fmtMoney(summary.avg_win, currency, LOCALE)}
						pct={avgWinAbs / avgDen}
						tone="pos"
					/>
					<StatBar
						label="AVG L"
						value={fmtMoney(summary.avg_loss, currency, LOCALE)}
						pct={avgLossAbs / avgDen}
						tone="neg"
					/>
				</div>
				<div
					className="flex flex-col items-end gap-1"
					style={{
						borderLeft: "1px solid var(--color-border)",
						paddingLeft: 20,
					}}
				>
					<span
						className="text-[11px] uppercase tracking-wide"
						style={{ color: "var(--color-text-muted)" }}
					>
						PnL
					</span>
					<span
						className={`text-2xl font-bold tabular-nums ${pnlColor(summary.net_pnl)}`}
						style={{ fontFamily: "var(--font-mono)" }}
					>
						{fmtSignedMoney(summary.net_pnl, currency, LOCALE)}
					</span>
					{pnlPct != null && (
						<span
							className={`text-[11px] tabular-nums ${pnlColor(summary.net_pnl)}`}
						>
							{(pnlPct * 100).toFixed(2)}%
						</span>
					)}
				</div>
			</div>
		</Panel>
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
		<div className="flex flex-col gap-4">
			{/* Top band: equity chart + stats strip */}
			<div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
				<div className="xl:col-span-2">
					<EquityBand
						loading={equityLoading}
						error={equityError}
						points={equityPoints}
						currency={currency}
						range={range}
						onRangeChange={setRange}
					/>
				</div>
				<div className="xl:col-span-3">
					<StatsStrip
						loading={summaryLoading}
						error={summaryError}
						summary={summary}
						trades={trades}
						currency={currency}
						starting={starting}
					/>
				</div>
			</div>

			{/* Trades table */}
			<Panel>
				{tradesLoading ? (
					<Skeleton height="240px" className="m-3" />
				) : tradesError ? (
					<p className="p-4 text-xs" style={{ color: "var(--color-neg)" }}>
						Failed to load trades.
					</p>
				) : trades.length === 0 ? (
					<EmptyState title="No trades in this range" />
				) : (
					<>
						<div style={{ maxHeight: 520 }}>
							<DataTable
								columns={tradeColumns(currency, onSelectTrade)}
								data={trades}
								onRowClick={onSelectTrade}
							/>
						</div>
						<p
							className="text-center text-xs py-3"
							style={{ color: "var(--color-text-muted)" }}
						>
							All {trades.length} trades loaded
						</p>
					</>
				)}
			</Panel>
		</div>
	);
}
