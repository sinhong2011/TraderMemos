import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowData,
} from "@/lib/table";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { Toaster } from "@/components/Toaster";
import type { Account, ImportBatch } from "@/lib/api/types";
import { ImportHistorySection, sortImportBatches, type ImportHistoryRow } from "./import-history";

const state = vi.hoisted(() => ({ imports: [] as ImportBatch[], compact: false }));

vi.mock("../../../lib/hooks/useImports", () => ({
  useImports: () => ({ data: state.imports, isLoading: false, isError: false }),
  useDeleteImport: () => ({ mutate: () => {}, isPending: false }),
}));

vi.mock("../../../lib/hooks/use-mobile", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/hooks/use-mobile")>();
  return {
    ...actual,
    useMediaQuery: (query: string) =>
      query === actual.COMPACT_VIEWPORT ? state.compact : actual.useMediaQuery(query),
  };
});

vi.mock("../../../components/DataTable", () => ({
  DataTable: function MockDataTable<T extends RowData>({
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
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  },
}));

function renderSection(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Toaster>{ui}</Toaster>
    </QueryClientProvider>,
  );
}

const accounts = [{ id: "a1", name: "IB Main" } as Account];

function batch(partial: Partial<ImportBatch> & Pick<ImportBatch, "id">): ImportBatch {
  return {
    user_id: "u1",
    account_id: "a1",
    source: "ibkr-flex-sync",
    filename: "flex-1608397-20260801-100000.csv",
    column_mapping: null,
    row_count: 4,
    status: "committed",
    created_at: "2026-08-15T12:00:00Z",
    ...partial,
  };
}

describe("ImportHistorySection", () => {
  beforeEach(() => {
    state.compact = false;
    state.imports = [];
  });

  it("shows an empty state before anything is imported", () => {
    renderSection(<ImportHistorySection accounts={accounts} />);
    expect(screen.getByText("Nothing imported yet")).toBeInTheDocument();
  });

  it("renders a table of imports with rollback for committed rows only", () => {
    state.imports = [
      batch({ id: "b1" }),
      batch({
        id: "b2",
        status: "reversed",
        source: "csv",
        filename: "fills.csv",
        created_at: "2026-08-14T12:00:00Z",
      }),
    ];
    renderSection(<ImportHistorySection accounts={accounts} />);
    expect(screen.getByRole("columnheader", { name: "Date" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Source" })).toBeInTheDocument();
    expect(screen.getByText("IBKR Flex sync")).toBeInTheDocument();
    expect(screen.getByText("File import")).toBeInTheDocument();
    expect(screen.getByText("fills.csv")).toBeInTheDocument();
    expect(screen.getAllByText("IB Main")).not.toHaveLength(0);
    expect(screen.getByText("Rolled back")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Roll back/ })).toHaveLength(1);
  });

  it("hides empty Flex syncs until the filter is turned on", async () => {
    state.imports = [
      batch({
        id: "empty",
        row_count: 0,
        created_at: "2026-08-24T12:00:00Z",
      }),
      batch({ id: "data", row_count: 53, created_at: "2026-08-20T12:00:00Z" }),
    ];
    renderSection(<ImportHistorySection accounts={accounts} />);
    expect(screen.getAllByText("IBKR Flex sync")).toHaveLength(1);
    expect(screen.getByText("53")).toBeInTheDocument();
    expect(screen.queryByText("Empty")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Show empty syncs \(1\)/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Show empty syncs/ }));
    expect(screen.getByText("Empty")).toBeInTheDocument();
    expect(screen.getAllByText("IBKR Flex sync")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /Roll back/ })).toHaveLength(1);
  });

  it("sorts by created_at descending by default", () => {
    const older = {
      ...batch({ id: "old", created_at: "2026-07-01T12:00:00Z" }),
      account_name: "IB Main",
      source_label: "IBKR Flex sync",
      file_label: "",
    } as ImportHistoryRow;
    const newer = {
      ...batch({ id: "new", created_at: "2026-08-15T12:00:00Z" }),
      account_name: "IB Main",
      source_label: "IBKR Flex sync",
      file_label: "",
    } as ImportHistoryRow;
    expect(sortImportBatches([older, newer], []).map((r) => r.id)).toEqual(["new", "old"]);
  });

  it("labels batches for deleted accounts", () => {
    state.imports = [batch({ id: "b1", account_id: "gone" })];
    renderSection(<ImportHistorySection accounts={accounts} />);
    expect(screen.getByText("Deleted account")).toBeInTheDocument();
  });

  it("renders compact rows with date, count, and icon rollback", () => {
    state.compact = true;
    state.imports = [
      batch({ id: "flex", row_count: 53, created_at: "2026-08-20T12:00:00Z" }),
      batch({
        id: "file",
        source: "csv",
        filename: "fills.csv",
        row_count: 40,
        created_at: "2026-07-15T08:00:00Z",
      }),
      batch({
        id: "empty",
        row_count: 0,
        created_at: "2026-08-24T12:00:00Z",
      }),
    ];
    renderSection(<ImportHistorySection accounts={accounts} />);
    expect(screen.queryByRole("columnheader", { name: "Date" })).not.toBeInTheDocument();
    expect(screen.getByText("Flex")).toBeInTheDocument();
    expect(screen.getByText("File")).toBeInTheDocument();
    expect(screen.getByText("53")).toBeInTheDocument();
    expect(screen.getByText("fills.csv")).toBeInTheDocument();
    expect(screen.queryByText("Empty")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Roll back" })).toHaveLength(2);
  });
});
