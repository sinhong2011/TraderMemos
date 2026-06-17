import type { ColumnDef } from "@tanstack/react-table";
import { Search } from "lucide-react";
import { DataTable } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import { Panel } from "../../components/Panel";
import { Skeleton } from "../../components/Skeleton";
import { Toolbar } from "../../components/Toolbar";
import { pnlColor } from "../../components/theme-tokens";
import { fmtSignedMoney } from "../../lib/format";
import type { Trade } from "../../lib/api/types";

const LOCALE = "en-US";

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString(LOCALE, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function columns(currency: string): ColumnDef<Trade>[] {
  return [
    {
      accessorKey: "symbol",
      header: "Symbol",
      cell: (i) => <span style={{ color: "var(--color-text)" }}>{i.getValue<string>()}</span>,
    },
    {
      accessorKey: "direction",
      header: "Dir",
      cell: (i) => {
        const d = i.getValue<string>();
        return (
          <span style={{ color: d === "long" ? "var(--color-pos)" : "var(--color-neg)" }}>
            {d.toUpperCase()}
          </span>
        );
      },
    },
    {
      accessorKey: "instrument_type",
      header: "Type",
      cell: (i) => <span style={{ color: "var(--color-text-muted)" }}>{i.getValue<string>()}</span>,
    },
    {
      accessorKey: "opened_at",
      header: "Opened",
      cell: (i) => <span style={{ color: "var(--color-text-muted)" }}>{fmtDate(i.getValue<string>())}</span>,
    },
    {
      accessorKey: "closed_at",
      header: "Closed",
      cell: (i) => <span style={{ color: "var(--color-text-muted)" }}>{fmtDate(i.getValue<string | null>())}</span>,
    },
    {
      accessorKey: "qty_opened",
      header: "Qty",
      cell: (i) => <span className="tabular-nums">{i.getValue<number>()}</span>,
    },
    {
      accessorKey: "net_pnl",
      header: "Net P&L",
      cell: (i) => {
        const v = i.getValue<number | null>();
        if (v == null) return <span style={{ color: "var(--color-text-muted)" }}>-</span>;
        return <span className={`tabular-nums ${pnlColor(v)}`}>{fmtSignedMoney(v, currency, LOCALE)}</span>;
      },
    },
    {
      accessorKey: "return_pct",
      header: "Return",
      cell: (i) => {
        const v = i.getValue<number | null>();
        if (v == null) return <span style={{ color: "var(--color-text-muted)" }}>-</span>;
        return <span className={`tabular-nums ${pnlColor(v)}`}>{v.toFixed(2)}%</span>;
      },
    },
    {
      id: "tags",
      header: "Tags",
      cell: (i) => {
        const tags = i.row.original.tags ?? [];
        if (tags.length === 0) return <span style={{ color: "var(--color-text-muted)" }}>-</span>;
        return (
          <span style={{ color: "var(--color-text-muted)" }}>
            {tags.map((t) => t.name).join(", ")}
          </span>
        );
      },
    },
  ];
}

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
        <Search size={14} strokeWidth={1.5} style={{ color: "var(--color-text-muted)" }} />
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
      <span className="text-xs tabular-nums" style={{ color: "var(--color-text-muted)" }}>
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
        <EmptyState title="No trades match these filters" hint="Adjust the account, date range, or symbol filter." />
      ) : (
        <div style={{ height: 560 }}>
          <DataTable
            columns={columns(currency)}
            data={trades}
            onRowClick={(t) => onSelectTrade(t.id)}
          />
        </div>
      )}
    </Panel>
  );
}
