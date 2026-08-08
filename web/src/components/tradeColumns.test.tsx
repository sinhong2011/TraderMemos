import type { ColumnDef } from "@/lib/table";
import { flexRender, getCoreRowModel, useReactTable, type RowData } from "@/lib/table";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import type { Trade } from "@/lib/api/types";
import {
  marketLabel,
  TRADE_COLUMN_PINNING,
  tradeColumns,
  tradeNotional,
  tradeNotionalMultiplier,
  tradeRMultiple,
  tradeStatus,
} from "./tradeColumns";

vi.mock("./Toast", () => ({
  useToastManager: () => ({ add: vi.fn<(...args: any[]) => any>() }),
}));

vi.mock("../lib/hooks/useTradeDetail", () => ({
  useDeleteTrade: () => ({
    mutateAsync: vi.fn<(...args: any[]) => any>(),
    isPending: false,
  }),
}));

// Mock DataTable: the real one uses a virtualizer that needs a sized container (absent in jsdom).
// Render cells using the provided column definitions.
vi.mock("./DataTable", () => ({
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
  qty_remaining: 0,
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
  initial_risk: 50,
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

describe("tradeRMultiple", () => {
  it("divides net P&L by initial risk", () => {
    expect(tradeRMultiple(TRADE)).toBeCloseTo(0.2278);
    expect(tradeRMultiple({ ...TRADE, initial_risk: null })).toBeNull();
    expect(tradeRMultiple({ ...TRADE, net_pnl: null })).toBeNull();
  });
});

describe("marketLabel", () => {
  it("maps instrument types", () => {
    expect(marketLabel("stock")).toBe("STK");
    expect(marketLabel("option")).toBe("OPT");
    expect(marketLabel("warrant")).toBe("WAR");
  });
});

describe("tradeNotional", () => {
  it("applies ×100 for options and ×1 for stocks", () => {
    expect(tradeNotionalMultiplier("option")).toBe(100);
    expect(tradeNotionalMultiplier("stock")).toBe(1);
    expect(tradeNotional(3, 1.64, "option")).toBeCloseTo(492);
    expect(tradeNotional(90, 16.62, "stock")).toBeCloseTo(1495.8);
  });
});

describe("tradeColumns", () => {
  it("renders a full trade row", () => {
    render(
      <DataTable
        columns={tradeColumns("USD", { onOpenFullPage: vi.fn<(...args: any[]) => any>() })}
        data={[TRADE]}
        columnPinning={TRADE_COLUMN_PINNING}
      />,
    );
    expect(screen.getByText("TSLQ")).toBeInTheDocument();
    expect(screen.getByText("WIN")).toBeInTheDocument();
    expect(screen.getByText("STK")).toBeInTheDocument();
    expect(screen.getByText("39m")).toBeInTheDocument();
    expect(screen.getByText("+$11.39")).toBeInTheDocument();
    expect(screen.getByText("0.79%")).toBeInTheDocument();
    expect(screen.getByText("$5.41")).toBeInTheDocument();
    expect(screen.getByText("+0.23R")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Fees" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Close" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "R" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Tags" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Actions for TSLQ" })).toBeInTheDocument();
  });

  it("renders tag pills when present", () => {
    const tagged: Trade = {
      ...TRADE,
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
    };
    render(
      <DataTable
        columns={tradeColumns("USD", { onOpenFullPage: vi.fn<(...args: any[]) => any>() })}
        data={[tagged]}
        columnPinning={TRADE_COLUMN_PINNING}
      />,
    );
    expect(screen.getByText("Breakout")).toBeInTheDocument();
  });

  it("shows option entry/exit totals with contract multiplier", () => {
    const optionTrade: Trade = {
      ...TRADE,
      id: "opt1",
      symbol: "NVDA",
      instrument_type: "option",
      qty_opened: 3,
      avg_entry_price: 1.64,
      avg_exit_price: 1.45,
      net_pnl: -61.15,
      return_pct: -12.43,
    };
    render(
      <DataTable
        columns={tradeColumns("USD", { onOpenFullPage: vi.fn<(...args: any[]) => any>() })}
        data={[optionTrade]}
        columnPinning={TRADE_COLUMN_PINNING}
      />,
    );
    expect(screen.getByText("$492.00")).toBeInTheDocument();
    expect(screen.getByText("$435.00")).toBeInTheDocument();
  });
});
