import type { ColumnDef } from "@tanstack/react-table";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import type { Trade } from "@/lib/api/types";
import { TradesView, sortTrades } from "./TradesView";

vi.mock("../../lib/hooks/useMoneyFx", () => ({
  useMoneyFx: (currency: string) => ({ currency, rate: 1 }),
}));

vi.mock("../../lib/hooks/useTradeDetail", () => ({
  useDeleteTrade: () => ({
    mutateAsync: vi.fn<(...args: any[]) => any>(),
    isPending: false,
  }),
}));

vi.mock("../../components/Toast", () => ({
  useToastManager: () => ({ add: vi.fn<(...args: any[]) => any>() }),
}));

vi.mock("../../components/OptionsSelect", () => ({
  OptionsSelect: ({
    value,
    onValueChange,
    ariaLabel,
    options,
  }: {
    value: string;
    onValueChange: (v: string) => void;
    ariaLabel?: string;
    options?: { value: string; label: ReactNode }[];
  }) => (
    <select aria-label={ariaLabel} value={value} onChange={(e) => onValueChange(e.target.value)}>
      {(
        options ?? [
          { value: "10", label: "10" },
          { value: "20", label: "20" },
          { value: "30", label: "30" },
          { value: "40", label: "40" },
          { value: "50", label: "50" },
          { value: "100", label: "100" },
        ]
      ).map((o) => (
        <option key={o.value} value={o.value}>
          {typeof o.label === "string" ? o.label : o.value}
        </option>
      ))}
    </select>
  ),
}));

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
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} onClick={() => onRowClick?.(row.original)}>
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
  symbols: [] as string[],
  onSymbolsChange: vi.fn<(...args: any[]) => any>(),
  onSelectTrade: vi.fn<(...args: any[]) => any>(),
  onOpenFullPage: vi.fn<(...args: any[]) => any>(),
  totalInScope: 0,
  scopeLoading: false,
  hasNarrowingFilters: false,
  onClearFilters: vi.fn<(...args: any[]) => any>(),
  onImport: vi.fn<(...args: any[]) => any>(),
  onNewTrade: vi.fn<(...args: any[]) => any>(),
};

describe("TradesView", () => {
  it("renders trade rows and a count", () => {
    render(
      <TradesView
        {...base}
        totalInScope={2}
        trades={[
          trade({ id: "t1", symbol: "AAPL", net_pnl: 198 }),
          trade({ id: "t2", symbol: "MSFT", net_pnl: -102 }),
        ]}
      />,
    );
    expect(screen.getByText("Symbol")).toBeInTheDocument();
    expect(screen.getByText("P&L %")).toBeInTheDocument();
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByText("MSFT")).toBeInTheDocument();
    expect(screen.getByText("WIN")).toBeInTheDocument();
    expect(screen.getByText("1–2 of 2")).toBeInTheDocument();
  });

  it("shows onboarding empty state when journal is empty", () => {
    render(<TradesView {...base} trades={[]} />);
    expect(screen.getByText("No trades yet")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /import csv/i })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /log trade/i })).toHaveLength(2);
  });

  it("shows filtered empty state when scope has trades but list is empty", () => {
    render(
      <TradesView {...base} trades={[]} totalInScope={3} hasNarrowingFilters symbols={["ZZZZ"]} />,
    );
    expect(screen.getByText("No trades match these filters")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /clear filters/i }).length).toBeGreaterThan(0);
  });

  it("wires header actions", async () => {
    const user = userEvent.setup();
    const onImport = vi.fn<(...args: any[]) => any>();
    const onNewTrade = vi.fn<(...args: any[]) => any>();
    render(<TradesView {...base} trades={[]} onImport={onImport} onNewTrade={onNewTrade} />);
    await user.click(screen.getAllByRole("button", { name: /import csv/i })[0]);
    await user.click(screen.getAllByRole("button", { name: /log trade/i })[0]);
    expect(onImport).toHaveBeenCalledOnce();
    expect(onNewTrade).toHaveBeenCalledOnce();
  });

  it("wires status faceted filter", async () => {
    const user = userEvent.setup();
    const onToggleTradeStatus = vi.fn<(...args: any[]) => any>();
    render(
      <TradesView
        {...base}
        totalInScope={1}
        trades={[trade({ id: "t1", symbol: "AAPL", net_pnl: 10 })]}
        onToggleTradeStatus={onToggleTradeStatus}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Status" }));
    await user.click(screen.getByRole("option", { name: /Wins/i }));
    expect(onToggleTradeStatus).toHaveBeenCalledWith("win");
  });

  it("wires symbol combobox options", async () => {
    const user = userEvent.setup();
    const onSymbolsChange = vi.fn<(...args: any[]) => any>();
    render(
      <TradesView
        {...base}
        totalInScope={2}
        trades={[
          trade({ id: "t1", symbol: "AAPL", net_pnl: 10 }),
          trade({ id: "t2", symbol: "MSFT", net_pnl: -5 }),
        ]}
        symbolOptions={[
          { value: "AAPL", label: "AAPL", count: 1 },
          { value: "MSFT", label: "MSFT", count: 1 },
        ]}
        onSymbolsChange={onSymbolsChange}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Filter symbol" }));
    await user.click(screen.getByRole("option", { name: /MSFT/i }));
    expect(onSymbolsChange).toHaveBeenCalledWith(["MSFT"]);
  });

  it("wires tags faceted filter", async () => {
    const user = userEvent.setup();
    const onTagIdsChange = vi.fn<(...args: any[]) => any>();
    render(
      <TradesView
        {...base}
        totalInScope={1}
        trades={[
          trade({
            id: "t1",
            symbol: "AAPL",
            tags: [
              {
                id: "tag1",
                user_id: "u1",
                name: "Breakout",
                color: "",
                description: "",
                kind: "custom",
              },
            ],
          }),
        ]}
        tagOptions={[{ value: "tag1", label: "Breakout", count: 1 }]}
        onTagIdsChange={onTagIdsChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Tags" }));
    await user.click(screen.getByRole("option", { name: /Breakout/i }));
    expect(onTagIdsChange).toHaveBeenCalledWith(["tag1"]);
  });

  it("wires market faceted filter", async () => {
    const user = userEvent.setup();
    const onMarketsChange = vi.fn<(...args: any[]) => any>();
    render(
      <TradesView
        {...base}
        totalInScope={1}
        trades={[trade({ id: "t1", symbol: "AAPL", instrument_type: "stock" })]}
        marketOptions={[{ value: "stock", label: "Stock", count: 1 }]}
        onMarketsChange={onMarketsChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Market" }));
    await user.click(screen.getByRole("option", { name: /Stock/i }));
    expect(onMarketsChange).toHaveBeenCalledWith(["stock"]);
  });

  it("paginates long trade lists", async () => {
    const user = userEvent.setup();
    const trades = Array.from({ length: 30 }, (_, i) =>
      trade({
        id: `t${i}`,
        symbol: `S${String(i).padStart(2, "0")}`,
        net_pnl: i % 2 === 0 ? 10 : -10,
      }),
    );
    render(<TradesView {...base} totalInScope={30} trades={trades} />);

    expect(screen.getByText("1–20 of 30")).toBeInTheDocument();
    expect(screen.getByText("S00")).toBeInTheDocument();
    expect(screen.queryByText("S20")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("21–30 of 30")).toBeInTheDocument();
    expect(screen.getByText("S20")).toBeInTheDocument();
    expect(screen.queryByText("S00")).not.toBeInTheDocument();
  });

  it("shows Created At, Sort, and View toolbar controls", () => {
    render(
      <TradesView {...base} totalInScope={1} trades={[trade({ id: "t1", symbol: "AAPL" })]} />,
    );
    expect(screen.getByText("Created At")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sort" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toggle columns" })).toBeInTheDocument();
  });

  it("opens Sort popover and adds a sort", async () => {
    const user = userEvent.setup();
    render(
      <TradesView {...base} totalInScope={1} trades={[trade({ id: "t1", symbol: "AAPL" })]} />,
    );
    await user.click(screen.getByRole("button", { name: "Sort" }));
    expect(screen.getByText("No sorting applied")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add sort" }));
    expect(screen.getByText("Sort by")).toBeInTheDocument();
    expect(screen.getByLabelText("Sort column")).toHaveValue("opened_at");
  });
});

describe("sortTrades", () => {
  it("sorts by symbol ascending then descending", () => {
    const rows = [
      trade({ id: "a", symbol: "MSFT", net_pnl: 1 }),
      trade({ id: "b", symbol: "AAPL", net_pnl: 2 }),
    ];
    expect(sortTrades(rows, [{ id: "symbol", desc: false }]).map((t) => t.symbol)).toEqual([
      "AAPL",
      "MSFT",
    ]);
    expect(sortTrades(rows, [{ id: "symbol", desc: true }]).map((t) => t.symbol)).toEqual([
      "MSFT",
      "AAPL",
    ]);
  });
});
