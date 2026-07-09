import { Search } from "lucide-react";
import { DataTable } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import { Panel } from "../../components/Panel";
import { Skeleton } from "../../components/Skeleton";
import { Toolbar } from "../../components/Toolbar";
import { tradeColumns } from "../../components/tradeColumns";
import type { Trade } from "../../lib/api/types";

export interface TradesViewProps {
	trades: Trade[];
	loading: boolean;
	error: boolean;
	currency: string;
	symbol: string;
	onSymbolChange: (s: string) => void;
	onSelectTrade: (id: string) => void;
}

export function TradesView({
	trades,
	loading,
	error,
	currency,
	symbol,
	onSymbolChange,
	onSelectTrade,
}: TradesViewProps) {
	const toolbar = (
		<Toolbar>
			<div className="flex items-center gap-2">
				<Search
					size={14}
					strokeWidth={1.5}
					style={{ color: "var(--color-text-muted)" }}
				/>
				<input
					value={symbol}
					onChange={(e) => onSymbolChange(e.target.value.toUpperCase())}
					placeholder="Filter symbol"
					aria-label="Filter symbol"
					style={{
						background: "var(--color-surface-hover)",
						color: "var(--color-text)",
						border: "1px solid var(--color-border)",
						borderRadius: "var(--radius-control)",
						padding: "5px 9px",
						fontSize: "12px",
						fontFamily: "var(--font-ui)",
						outline: "none",
					}}
				/>
			</div>
			<span
				className="text-xs tabular-nums"
				style={{ color: "var(--color-text-muted)" }}
			>
				{trades.length} trades
			</span>
		</Toolbar>
	);

	return (
		<Panel title="Trades" right={toolbar}>
			{loading ? (
				<Skeleton height="360px" className="m-4" />
			) : error ? (
				<p className="p-4 text-xs" style={{ color: "var(--color-neg)" }}>
					Failed to load trades.
				</p>
			) : trades.length === 0 ? (
				<EmptyState
					title="No trades match these filters"
					hint="Adjust the account, date range, or symbol filter."
				/>
			) : (
				<div style={{ height: 560 }}>
					<DataTable
						columns={tradeColumns(currency, (t) => onSelectTrade(t.id))}
						data={trades}
						onRowClick={(t) => onSelectTrade(t.id)}
					/>
				</div>
			)}
		</Panel>
	);
}
