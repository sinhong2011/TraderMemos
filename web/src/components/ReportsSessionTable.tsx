import type { ColumnDef } from "@tanstack/react-table";
import { Card } from "./Card";
import { DataTable } from "./DataTable";
import { EmptyState } from "./EmptyState";
import { useReportsMoney } from "./ReportsDisplayContext";
import { Skeleton } from "./Skeleton";
import { pnlColor } from "./theme-tokens";
import type { BreakGroup, Summary } from "../lib/api/types";
import { usePrivacyMode } from "../lib/displayPrefs";
import { fmtPct, fmtSignedMoney } from "../lib/format";
import { intlLocale } from "../lib/locale";

/** Net P&L cell — the only session-table column that honors the Reports
 * net/gross + $/% display mode; PF/avg-trade/expectancy stay net-$ (the API
 * doesn't expose gross variants of those derived per-trade stats). Exported
 * so tests can render it directly (DataTable is mocked in tests since its
 * virtualizer needs a sized container in jsdom, which bypasses real cells). */
export function SessionPnlCell({ summary }: { summary: Summary }) {
  const money = useReportsMoney();
  const pnl = money.pnl(summary);
  return <span className={`tabular-nums ${pnlColor(pnl)}`}>{money.format(pnl)}</span>;
}

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
      cell: (info) => <SessionPnlCell summary={info.row.original.summary} />,
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
    {
      id: "profit_factor",
      accessorFn: (row) => row.summary.profit_factor,
      header: "PF",
      cell: (info) => {
        const v = info.getValue<number>();
        return <span className="tabular-nums text-text">{v > 0 ? v.toFixed(2) : "—"}</span>;
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
    <Card title="Session Performance" flush>
      {loading ? (
        <div className="p-4">
          <Skeleton height="160px" />
        </div>
      ) : error ? (
        <p className="p-4 text-xs text-loss">Failed to load session performance.</p>
      ) : breakdown.length === 0 ? (
        <div className="p-4">
          <EmptyState
            title="No data"
            hint="Add trades or adjust filters to see session performance."
          />
        </div>
      ) : (
        <div style={{ maxHeight: 280 }}>
          <DataTable columns={buildSessionColumns(currency, locale, fxRate)} data={breakdown} />
        </div>
      )}
    </Card>
  );
}
