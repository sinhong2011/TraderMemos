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
import type { BreakGroup } from "../../lib/api/types";
import { fmtPct, fmtSignedMoney } from "../../lib/format";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BreakdownDim =
	| "symbol"
	| "setup"
	| "day_of_week"
	| "hour_of_day"
	| "tag";

const DIM_LABELS: Record<BreakdownDim, string> = {
	symbol: "Symbol",
	setup: "Setup",
	day_of_week: "Day of Week",
	hour_of_day: "Hour",
	tag: "Tag",
};

const ALL_DIMS: BreakdownDim[] = [
	"symbol",
	"setup",
	"day_of_week",
	"hour_of_day",
	"tag",
];

export interface ReportsViewProps {
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
	breakdown,
	loading,
	error,
	currency,
	dim,
	onDimChange,
}: ReportsViewProps) {
	const columns = buildColumns(currency, DIM_LABELS[dim]);

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
				{/* Chart */}
				<PnlBarChart data={breakdown} currency={currency} />

				{/* Table */}
				<div style={{ maxHeight: 360 }}>
					<DataTable columns={columns} data={breakdown} />
				</div>
			</>
		);
	};

	return (
		<div className="flex flex-col gap-4">
			<Panel title="Reports" right={panelRight}>
				{renderContent()}
			</Panel>
		</div>
	);
}
