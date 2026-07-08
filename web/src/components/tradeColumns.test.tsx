import type { ColumnDef } from "@tanstack/react-table";
import {
	flexRender,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Trade } from "../lib/api/types";
import { marketLabel, tradeColumns, tradeStatus } from "./tradeColumns";

// Mock DataTable: the real one uses a virtualizer that needs a sized container (absent in jsdom).
// Render cells using the provided column definitions.
vi.mock("./DataTable", () => ({
	DataTable: function MockDataTable<T>({
		columns,
		data,
	}: {
		columns: ColumnDef<T>[];
		data: T[];
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
						<tr key={row.id}>
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

import { DataTable } from "./DataTable";

const TRADE: Trade = {
	id: "t1",
	account_id: "a1",
	symbol: "TSLQ",
	instrument_type: "stock",
	direction: "long",
	status: "closed",
	opened_at: "2026-07-02T13:00:00Z",
	closed_at: "2026-07-02T13:39:00Z",
	qty_opened: 80,
	avg_entry_price: 18.02,
	avg_exit_price: 18.23,
	gross_pnl: 16.8,
	fees_total: 5.41,
	net_pnl: 11.39,
	pnl_currency: "USD",
	return_pct: 0.79,
	time_in_trade_secs: 2340,
	notes: "",
	tags: [],
};

describe("tradeStatus", () => {
	it("maps trades to status pills", () => {
		expect(tradeStatus(TRADE)).toEqual({ label: "WIN", tone: "pos" });
		expect(tradeStatus({ ...TRADE, net_pnl: -5 })).toEqual({
			label: "LOSS",
			tone: "neg",
		});
		expect(tradeStatus({ ...TRADE, status: "open", net_pnl: null })).toEqual({
			label: "OPEN",
			tone: "accent",
		});
		expect(tradeStatus({ ...TRADE, net_pnl: 0 })).toEqual({
			label: "BE",
			tone: "muted",
		});
	});
});

describe("marketLabel", () => {
	it("maps instrument types", () => {
		expect(marketLabel("stock")).toBe("STK");
		expect(marketLabel("option")).toBe("OPT");
		expect(marketLabel("warrant")).toBe("WAR");
	});
});

describe("tradeColumns", () => {
	it("renders a full trade row", () => {
		render(<DataTable columns={tradeColumns("USD", vi.fn())} data={[TRADE]} />);
		expect(screen.getByText("TSLQ")).toBeInTheDocument();
		expect(screen.getByText("WIN")).toBeInTheDocument();
		expect(screen.getByText("STK")).toBeInTheDocument();
		expect(screen.getByText("39m")).toBeInTheDocument();
		expect(screen.getByText("+$11.39")).toBeInTheDocument();
		expect(screen.getByText("0.79%")).toBeInTheDocument();
	});
});
