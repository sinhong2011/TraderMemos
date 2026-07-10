import type { ColumnDef } from "@tanstack/react-table";
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
import { ChartFrame, chartTheme } from "../../components/ChartFrame";
import { DataTable } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import { Panel } from "../../components/Panel";
import { Skeleton } from "../../components/Skeleton";
import { pnlColor } from "../../components/theme-tokens";
import type { BreakGroup, EquityCurve, RSummary, Summary } from "../../lib/api/types";
import { fmtMoney, fmtPct, fmtSignedMoney } from "../../lib/format";
import { SegmentedControl } from "../../components/SegmentedControl";

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
	| "mistake";

const DIM_LABELS: Record<BreakdownDim, string> = {
	symbol: "Symbol",
	setup: "Setup",
	day_of_week: "Day of Week",
	hour_of_day: "Hour",
	session: "Session",
	tag: "Tag",
	mistake: "Mistake",
};

const ALL_DIMS: BreakdownDim[] = [
	"symbol",
	"setup",
	"session",
	"day_of_week",
	"hour_of_day",
	"tag",
	"mistake",
];

export interface ReportsViewProps {
	summary?: Summary;
	summaryLoading: boolean;
	summaryError: boolean;
	rSummary?: RSummary;
	rSummaryLoading?: boolean;
	unit: "usd" | "r";
	onUnitChange: (unit: "usd" | "r") => void;
	equity?: EquityCurve;
	equityLoading: boolean;
	breakdown: BreakGroup[];
	loading: boolean;
	error: boolean;
	currency: string;
	dim: BreakdownDim;
	onDimChange: (dim: BreakdownDim) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOCALE = "en-US";
const POS_COLOR = "#52ca96"; // emerald-400
const NEG_COLOR = "#eb4b68"; // red-400

// ---------------------------------------------------------------------------
// Summary metrics grid (Stats page parity)
// ---------------------------------------------------------------------------

function SummaryMetricsGrid({
	summary,
	currency,
	unit,
	rSummary,
}: {
	summary: Summary;
	currency: string;
	unit: "usd" | "r";
	rSummary?: RSummary;
}) {
	const inR = unit === "r" && rSummary;
	const s = inR ? rSummary : summary;
	const moneyOrR = (v: number) =>
		inR ? `${v >= 0 ? "+" : ""}${v.toFixed(2)}R` : fmtSignedMoney(v, currency, LOCALE);
	const absOrR = (v: number) =>
		inR ? `${v.toFixed(2)}R` : fmtMoney(v, currency, LOCALE);

	const feePct =
		s.gross_profit + s.gross_loss !== 0
			? (s.total_fees / Math.abs(s.gross_profit + s.gross_loss)) * 100
			: 0;

	return (
		<div className="grid grid-cols-2 gap-px border-b border-border bg-border sm:grid-cols-3 lg:grid-cols-5">
			<StatCard
				label={inR ? "Net R" : "P&L"}
				value={moneyOrR(s.net_pnl)}
				accent={s.net_pnl >= 0 ? "pos" : "neg"}
				hint={
					inR
						? `Avg ${rSummary!.avg_r.toFixed(2)}R · ${rSummary!.excluded} excluded (no risk)`
						: `Gross ${fmtSignedMoney(s.gross_profit + s.gross_loss, currency, LOCALE)} · Fees ${fmtMoney(s.total_fees, currency, LOCALE)} (${feePct.toFixed(1)}%)`
				}
			/>
			<StatCard
				label="Win Rate"
				value={fmtPct(s.win_rate, LOCALE)}
				accent="none"
			/>
			<StatCard
				label="Profit Factor"
				value={s.profit_factor > 0 ? s.profit_factor.toFixed(2) : "—"}
			/>
			<StatCard label="Total Trades" value={String(s.total_trades)} />
			<StatCard
				label="Expectancy"
				value={moneyOrR(s.expectancy)}
				accent={s.expectancy >= 0 ? "pos" : "neg"}
			/>
			<StatCard
				label={inR ? "Avg Win R" : "Avg Win"}
				value={inR ? `${rSummary!.avg_win_r.toFixed(2)}R` : absOrR(s.avg_win)}
				accent="pos"
			/>
			<StatCard
				label={inR ? "Avg Loss R" : "Avg Loss"}
				value={
					inR
						? `${rSummary!.avg_loss_r.toFixed(2)}R`
						: absOrR(s.avg_loss)
				}
				accent="neg"
			/>
			<StatCard
				label={inR ? "Best R" : "Largest Win"}
				value={inR ? `${rSummary!.best_r.toFixed(2)}R` : absOrR(s.largest_win)}
				accent="pos"
			/>
			<StatCard
				label={inR ? "Worst R" : "Largest Loss"}
				value={
					inR ? `${rSummary!.worst_r.toFixed(2)}R` : absOrR(s.largest_loss)
				}
				accent="neg"
			/>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Table columns
// ---------------------------------------------------------------------------

function buildColumns(
	currency: string,
	dimLabel: string,
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
				<span
					className="tabular-nums"
					style={{ color: "var(--color-text-muted)" }}
				>
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
					{fmtPct(info.getValue<number>(), LOCALE)}
				</span>
			),
		},
		{
			id: "net_pnl",
			accessorFn: (row) => row.summary.net_pnl,
			header: "Net P&L",
			cell: (info) => {
				const v = info.getValue<number>();
				return (
					<span className={`tabular-nums ${pnlColor(v)}`}>
						{fmtSignedMoney(v, currency, LOCALE)}
					</span>
				);
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
				return (
					<span className={`tabular-nums ${pnlColor(v)}`}>
						{fmtSignedMoney(v, currency, LOCALE)}
					</span>
				);
			},
		},
	];
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
			{ALL_DIMS.map((d) => {
				const active = d === value;
				return (
					<button
						key={d}
						onClick={() => onChange(d)}
						style={{
							padding: "4px 10px",
							fontSize: 11,
							fontFamily: "inherit",
							border: "1px solid var(--color-border)",
							borderRadius: "var(--radius-control)",
							cursor: "pointer",
							background: active ? "var(--color-accent-subtle)" : "transparent",
							color: active ? "var(--color-accent)" : "var(--color-text-muted)",
							transition:
								"background var(--duration-fast), color var(--duration-fast)",
							fontWeight: active ? 600 : 400,
							whiteSpace: "nowrap",
						}}
					>
						{DIM_LABELS[d]}
					</button>
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
}

function PnlBarChart({ data, currency }: PnlBarChartProps) {
	const chartData = data.map((g) => ({
		key: g.key,
		net_pnl: g.summary.net_pnl,
	}));

	return (
		<ChartFrame className="border-0 rounded-none">
			<ResponsiveContainer width="100%" height={200}>
				<BarChart
					data={chartData}
					margin={{ top: 12, right: 16, bottom: 0, left: 0 }}
				>
					<CartesianGrid vertical={false} stroke={chartTheme.gridColor} />
					<XAxis
						dataKey="key"
						tick={{ fontSize: 10, fill: chartTheme.axisColor }}
						axisLine={false}
						tickLine={false}
					/>
					<YAxis
						tick={{ fontSize: 10, fill: chartTheme.axisColor }}
						tickFormatter={(v: number) => fmtSignedMoney(v, currency, LOCALE)}
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
						formatter={(value: number) => [
							fmtSignedMoney(value, currency, LOCALE),
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
	unit,
	onUnitChange,
	equity,
	equityLoading,
	breakdown,
	loading,
	error,
	currency,
	dim,
	onDimChange,
}: ReportsViewProps) {
	const columns = buildColumns(currency, DIM_LABELS[dim]);

	const panelRight = (
		<div className="flex items-center gap-2">
			<SegmentedControl
				ariaLabel="Report unit"
				value={unit}
				onChange={(v) => onUnitChange(v as "usd" | "r")}
				options={[
					{ value: "usd", label: "$" },
					{ value: "r", label: "R" },
				]}
			/>
			<DimSelector value={dim} onChange={onDimChange} />
		</div>
	);

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
			return (
				<p className="p-4 text-xs" style={{ color: "var(--color-neg)" }}>
					Failed to load breakdown data.
				</p>
			);
		}

		if (breakdown.length === 0) {
			return (
				<EmptyState
					title="No data"
					hint="Add trades or adjust filters to see a breakdown."
				/>
			);
		}

		return (
			<>
				<PnlBarChart data={breakdown} currency={currency} />

				<div style={{ maxHeight: 360 }}>
					<DataTable columns={columns} data={breakdown} />
				</div>
			</>
		);
	};

	return (
		<div className="flex flex-col gap-4">
			{summaryLoading ? (
				<Skeleton height="120px" />
			) : summaryError ? (
				<p className="p-4 text-xs text-loss">Failed to load summary.</p>
			) : summary ? (
				<Panel title="Statistics" className="overflow-hidden">
					<SummaryMetricsGrid
						summary={summary}
						currency={currency}
						unit={unit}
						rSummary={rSummary}
					/>
					{unit === "r" && rSummary && rSummary.distribution.length > 0 && (
						<div className="border-t border-border px-3 py-2">
							<p className="mb-2 font-mono text-[10px] font-medium uppercase tracking-widest text-text-dim">
								R-multiple distribution
							</p>
							<div className="flex flex-wrap gap-2">
								{rSummary.distribution.map((b) => (
									<span
										key={b.label}
										className="rounded-sharp border border-border px-2 py-1 font-mono text-[11px] text-text-muted"
									>
										{b.label}: {b.count}
									</span>
								))}
							</div>
						</div>
					)}
					{equityLoading ? (
						<Skeleton height="160px" className="m-3" />
					) : equity && equity.points.length > 0 ? (
						<div className="border-t border-border p-3">
							<p className="mb-2 font-mono text-[10px] font-medium uppercase tracking-widest text-text-dim">
								Equity curve · Max DD{" "}
								{fmtMoney(equity.max_drawdown, currency, LOCALE)}
							</p>
							<ChartFrame>
								<ResponsiveContainer width="100%" height={160}>
									<BarChart
										data={equity.points}
										margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
									>
										<CartesianGrid
											vertical={false}
											stroke={chartTheme.gridColor}
										/>
										<XAxis
											dataKey="at"
											tick={{ fontSize: 10, fill: chartTheme.axisColor }}
											tickFormatter={(v: string) => v.slice(5, 10)}
											axisLine={false}
											tickLine={false}
										/>
										<YAxis
											tick={{ fontSize: 10, fill: chartTheme.axisColor }}
											tickFormatter={(v: number) =>
												fmtMoney(v, currency, LOCALE)
											}
											axisLine={false}
											tickLine={false}
											width={64}
										/>
										<Tooltip
											contentStyle={{
												background: chartTheme.tooltipBg,
												border: `1px solid ${chartTheme.tooltipBorder}`,
												color: chartTheme.tooltipText,
												fontSize: 11,
												fontFamily: "var(--font-mono)",
											}}
											formatter={(value: number) => [
												fmtMoney(value, currency, LOCALE),
												"Equity",
											]}
										/>
										<Bar
											dataKey="equity"
											fill={chartTheme.accentStroke}
											radius={[2, 2, 0, 0]}
											fillOpacity={0.85}
										/>
									</BarChart>
								</ResponsiveContainer>
							</ChartFrame>
						</div>
					) : null}
				</Panel>
			) : null}

			<Panel title="Breakdown" right={panelRight}>
				{renderContent()}
			</Panel>
		</div>
	);
}
