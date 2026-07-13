import type { ColumnDef } from "@tanstack/react-table";
import type { JournalTradePreview } from "../lib/api/types";
import { fmtSignedMoney } from "../lib/format";
import { formatOptionTypeLabel, type OptionRightOverride } from "../lib/importOptionRight";
import { intlLocale } from "../lib/locale";
import { cn } from "../lib/cn";

export function journalTradePreviewColumns(
  currency: string,
  onDetails?: (trade: JournalTradePreview) => void,
  optionOverrides: Record<number, OptionRightOverride> = {},
): ColumnDef<JournalTradePreview>[] {
  const locale = intlLocale();
  const columns: ColumnDef<JournalTradePreview>[] = [
    {
      accessorKey: "symbol",
      header: "Symbol",
      cell: (info) => <span className="font-medium text-text">{info.getValue<string>()}</span>,
    },
    {
      id: "market",
      header: "Market",
      accessorFn: (row) => formatOptionTypeLabel(row, optionOverrides),
      cell: (info) => {
        const trade = info.row.original;
        const label = info.getValue<string>();
        const needsType = trade.instrument_type === "option" && label === "Set type";
        return (
          <span
            className={cn(
              "text-[11px] uppercase tracking-wide",
              needsType ? "text-signal" : "text-text-muted",
            )}
          >
            {label}
          </span>
        );
      },
    },
    {
      accessorKey: "side",
      header: "Side",
      cell: (info) => <span className="text-text-muted">{info.getValue<string>()}</span>,
    },
    {
      accessorKey: "qty",
      header: "Qty",
      meta: { align: "right" },
      cell: (info) => <span className="tabular-nums">{info.getValue<number>()}</span>,
    },
    {
      accessorKey: "entry",
      header: "Entry",
      meta: { align: "right" },
      cell: (info) => <span className="tabular-nums">{info.getValue<number>().toFixed(2)}</span>,
    },
    {
      accessorKey: "exit",
      header: "Exit",
      meta: { align: "right" },
      cell: (info) => <span className="tabular-nums">{info.getValue<number>().toFixed(2)}</span>,
    },
    {
      accessorKey: "return_usd",
      header: "Return",
      meta: { align: "right" },
      cell: (info) => {
        const value = info.getValue<number>();
        return (
          <span
            className={cn("tabular-nums font-semibold", value >= 0 ? "text-profit" : "text-loss")}
          >
            {fmtSignedMoney(value, currency, locale)}
          </span>
        );
      },
    },
  ];

  if (onDetails) {
    columns.push({
      id: "actions",
      header: "",
      enableSorting: false,
      meta: { align: "right" },
      cell: (info) => (
        <button
          type="button"
          className="cursor-pointer rounded-control border border-border bg-bg-inset px-2 py-0.5 text-[11px] text-text-muted transition-colors hover:border-border-strong hover:bg-bg-hover hover:text-text"
          onClick={(e) => {
            e.stopPropagation();
            onDetails(info.row.original);
          }}
        >
          Details
        </button>
      ),
    });
  }

  return columns;
}

export function csvSampleColumns(headers: string[]): ColumnDef<Record<string, string>>[] {
  return headers.map((header) => ({
    id: header,
    accessorFn: (row) => row[header] ?? "",
    header,
    enableSorting: false,
    cell: (info) => (
      <span className="text-[11px] tabular-nums text-text-muted">
        {String(info.getValue() || "-")}
      </span>
    ),
  }));
}
