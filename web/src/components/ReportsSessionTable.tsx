import type { ColumnDef } from "@tanstack/react-table";
import { Card } from "./Card";
import { DataTable } from "./DataTable";
import { EmptyState } from "./EmptyState";
import { Skeleton } from "./Skeleton";
import { pnlColor } from "./theme-tokens";
import type { BreakGroup } from "../lib/api/types";
import { usePrivacyMode } from "../lib/displayPrefs";
import { fmtPct, fmtSignedMoney } from "../lib/format";
import { intlLocale } from "../lib/locale";

export interface ReportsSessionTableProps {
  breakdown: BreakGroup[];
  loading: boolean;
  error: boolean;
  currency: string;
  fxRate?: number;
}

function buildSessionColumns(
  currency: string,
  locale: string,
  fxRate: number,
): ColumnDef<BreakGroup>[] {
  return [
    {
      accessorKey: "key",
      header: "Session",
      cell: (info) => <span className="font-medium text-text">{info.getValue<string>()}</span>,
    },
    {
      id: "total_trades",
      accessorFn: (row) => row.summary.total_trades,
      header: "Trades",
      cell: (info) => (
        <span className="tabular-nums text-text-muted">{info.getValue<number>()}</span>
      ),
    },
    {
      id: "win_rate",
      accessorFn: (row) => row.summary.win_rate,
      header: "Win %",
      cell: (info) => (
        <span className="tabular-nums text-text">{fmtPct(info.getValue<number>(), locale)}</span>
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
            {fmtSignedMoney(v * fxRate, currency, locale)}
          </span>
        );
      },
    },
    {
      id: "avg_trade",
      accessorFn: (row) => row.summary.avg_trade,
      header: "Avg/Trade",
      cell: (info) => {
        const v = info.getValue<number>();
        return (
          <span className={`tabular-nums ${pnlColor(v)}`}>
            {fmtSignedMoney(v * fxRate, currency, locale)}
          </span>
        );
      },
    },
  ];
}

export function ReportsSessionTable({
  breakdown,
  loading,
  error,
  currency,
  fxRate = 1,
}: ReportsSessionTableProps) {
  usePrivacyMode();
  const locale = intlLocale();

  return (
    <Card title="Session Performance">
      {loading ? (
        <Skeleton height="160px" />
      ) : error ? (
        <p className="text-xs text-loss">Failed to load session performance.</p>
      ) : breakdown.length === 0 ? (
        <EmptyState
          title="No data"
          hint="Add trades or adjust filters to see session performance."
        />
      ) : (
        <div style={{ maxHeight: 240 }}>
          <DataTable columns={buildSessionColumns(currency, locale, fxRate)} data={breakdown} />
        </div>
      )}
    </Card>
  );
}
