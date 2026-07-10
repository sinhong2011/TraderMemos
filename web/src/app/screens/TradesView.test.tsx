import type { ColumnDef } from "@tanstack/react-table";
import {
	flexRender,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Trade } from "../../lib/api/types";
import { TradesView } from "./TradesView";

// Mock DataTable: the real one uses a virtualizer that needs a sized scroll
// container (absent in jsdom). Render cells using the provided column
// definitions, mirroring src/components/tradeColumns.test.tsx and
// src/app/screens/DashboardView.test.tsx, which hit the same jsdom gotcha.
vi.mock("../../components/DataTable", () => ({
	DataTable: function MockDataTable<T>({
		columns,
		data,
		onRowClick,
	}: {
		columns: ColumnDef<T>[];
		data: T[];
		onRowClick?: (row: T) => void;
	}) {
		const table = useReactTable({
			data,
			columns,
			getCoreRowModel: getCoreRowModel(),
		});

		return (
			<table>
				<thead>
					{table.getHeaderGroups().map((headerGroup) => (
						<tr key={headerGroup.id}>
							{headerGroup.headers.map((header) => (
								<th key={header.id}>
									{header.isPlaceholder
										? null
										: flexRender(
												header.column.columnDef.header,
												header.getContext(),
											)}
								</th>
							))}
						</tr>
					))}
				</thead>
				<tbody>
					{table.getRowModel().rows.map((row) => (
						<tr key={row.id} onClick={() => onRowClick?.(row.original)}>
							{row.getVisibleCells().map((cell) => (
								<td key={cell.id}>
									{flexRender(cell.column.columnDef.cell, cell.getContext())}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		);
	},
}));

function trade(over: Partial<Trade>): Trade {
	return {
		id: "t1",
		account_id: "a1",
		symbol: "AAPL",
		instrument_type: "stock",
		direction: "long",
		status: "closed",
		opened_at: "2026-01-01T10:00:00Z",
		closed_at: "2026-01-01T11:00:00Z",
		qty_opened: 100,
		qty_remaining: 0,
		avg_entry_price: 10,
		avg_exit_price: 12,
		gross_pnl: 200,
		fees_total: 2,
		net_pnl: 198,
		pnl_currency: "USD",
		return_pct: 19.8,
		time_in_trade_secs: 3600,
		notes: "",
		tags: [],
		...over,
	} as Trade;
}

const base = {
	loading: false,
	error: false,
	currency: "USD",
	symbol: "",
	onSymbolChange: vi.fn(),
	onSelectTrade: vi.fn(),
};

describe("TradesView", () => {
	it("renders trade rows and a count", () => {
		render(
			<TradesView
				{...base}
				trades={[
					trade({ id: "t1", symbol: "AAPL", net_pnl: 198 }),
					trade({ id: "t2", symbol: "MSFT", net_pnl: -102 }),
				]}
			/>,
		);
		expect(screen.getByText("SYMBOL")).toBeInTheDocument();
		expect(screen.getByText("RETURN %")).toBeInTheDocument();
		expect(screen.getByText("AAPL")).toBeInTheDocument();
		expect(screen.getByText("MSFT")).toBeInTheDocument();
		expect(screen.getByText("WIN")).toBeInTheDocument();
		expect(screen.getByText("2 trades")).toBeInTheDocument();
	});

	it("shows an empty state when there are no trades", () => {
		render(<TradesView {...base} trades={[]} />);
		expect(
			screen.getByText("No trades match these filters"),
		).toBeInTheDocument();
	});
});
