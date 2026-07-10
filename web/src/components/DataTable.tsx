import {
	type ColumnDef,
	type SortingState,
	flexRender,
	getCoreRowModel,
	getSortedRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { useRef, useState } from "react";

interface DataTableProps<T> {
	columns: ColumnDef<T>[];
	data: T[];
	onRowClick?: (row: T) => void;
}

export function DataTable<T>({ columns, data, onRowClick }: DataTableProps<T>) {
	const [sorting, setSorting] = useState<SortingState>([]);
	const tableContainerRef = useRef<HTMLDivElement>(null);

	const table = useReactTable({
		data,
		columns,
		state: { sorting },
		onSortingChange: setSorting,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
	});

	const { rows } = table.getRowModel();

	const rowVirtualizer = useVirtualizer({
		count: rows.length,
		getScrollElement: () => tableContainerRef.current,
		estimateSize: () => 44,
		overscan: 10,
	});

	const virtualRows = rowVirtualizer.getVirtualItems();
	const totalSize = rowVirtualizer.getTotalSize();
	const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
	const paddingBottom =
		virtualRows.length > 0
			? totalSize - virtualRows[virtualRows.length - 1].end
			: 0;

	return (
		<div
			ref={tableContainerRef}
			className="overflow-auto"
			style={{
				fontFamily: "var(--font-ui)",
				fontSize: "13px",
				maxHeight: "100%",
			}}
		>
			<table className="w-full border-collapse">
				<thead
					style={{
						background: "var(--color-surface-panel)",
						position: "sticky",
						top: 0,
						zIndex: 1,
					}}
				>
					{table.getHeaderGroups().map((headerGroup) => (
						<tr key={headerGroup.id}>
							{headerGroup.headers.map((header) => {
								const sorted = header.column.getIsSorted();
								const canSort = header.column.getCanSort();
								return (
									<th
										key={header.id}
										className="px-3 py-2.5 text-left font-medium select-none text-[11px] uppercase tracking-wide"
										style={{
											color: "var(--color-text-muted)",
											borderBottom: "1px solid var(--color-border)",
											cursor: canSort ? "pointer" : "default",
											whiteSpace: "nowrap",
										}}
										onClick={
											canSort
												? header.column.getToggleSortingHandler()
												: undefined
										}
									>
										<span className="flex items-center gap-1">
											{header.isPlaceholder
												? null
												: flexRender(
														header.column.columnDef.header,
														header.getContext(),
													)}
											{canSort && (
												<span className="opacity-50 ml-0.5">
													{sorted === "asc" ? (
														<ChevronUp size={12} strokeWidth={1.5} />
													) : sorted === "desc" ? (
														<ChevronDown size={12} strokeWidth={1.5} />
													) : (
														<ChevronsUpDown size={12} strokeWidth={1.5} />
													)}
												</span>
											)}
										</span>
									</th>
								);
							})}
						</tr>
					))}
				</thead>
				<tbody>
					{paddingTop > 0 && (
						<tr>
							<td
								style={{ height: `${paddingTop}px` }}
								colSpan={columns.length}
							/>
						</tr>
					)}
					{virtualRows.map((virtualRow) => {
						const row = rows[virtualRow.index];
						return (
							<tr
								key={row.id}
								style={{
									cursor: onRowClick ? "pointer" : "default",
									transition: "background var(--duration-fast)",
								}}
								className="group"
								onClick={() => onRowClick?.(row.original)}
								onMouseEnter={(e) => {
									(e.currentTarget as HTMLElement).style.background =
										"var(--color-surface-hover)";
								}}
								onMouseLeave={(e) => {
									(e.currentTarget as HTMLElement).style.background = "";
								}}
							>
								{row.getVisibleCells().map((cell) => (
									<td
										key={cell.id}
										className="px-3 py-3"
										style={{
											color: "var(--color-text)",
											borderBottom: "1px solid var(--color-border)",
											whiteSpace: "nowrap",
										}}
									>
										{flexRender(cell.column.columnDef.cell, cell.getContext())}
									</td>
								))}
							</tr>
						);
					})}
					{paddingBottom > 0 && (
						<tr>
							<td
								style={{ height: `${paddingBottom}px` }}
								colSpan={columns.length}
							/>
						</tr>
					)}
				</tbody>
			</table>
		</div>
	);
}
