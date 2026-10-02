import type { ColumnDef } from "@/lib/table";
import { Pencil } from "lucide-react";
import type { JournalTradePreview } from "@/lib/api/types";
import { cn } from "@/lib/cn";

import {
  effectiveOptionRight,
  formatMarketLabel,
  type OptionRightOverride,
} from "@/lib/importOptionRight";
import { intlLocale } from "@/lib/locale";
import { resolveTradeDirection } from "@/lib/tradeDirection";
import { DirCell } from "./DirCell";
import { Button } from "./ui/button";
import { useMoneyFormatters } from "@/lib/useMoneyFormatters";

function ReturnCell({ value, currency }: { value: number; currency: string }) {
  const { fmtSignedMoney } = useMoneyFormatters();
  const locale = intlLocale();
  return (
    <span
      className={cn("tabular-nums font-semibold", value >= 0 ? "text-profit" : "text-destructive")}
    >
      {fmtSignedMoney(value, currency, locale)}
    </span>
  );
}

export function journalTradePreviewColumns(
  currency: string,
  onEdit?: (trade: JournalTradePreview) => void,
  optionOverrides: Record<number, OptionRightOverride> = {},
): ColumnDef<JournalTradePreview>[] {
  const columns: ColumnDef<JournalTradePreview>[] = [
    {
      accessorKey: "symbol",
      header: "Symbol",
      cell: (info) => (
        <span className="font-medium text-foreground">{info.getValue<string>()}</span>
      ),
    },
    {
      id: "market",
      header: "Market",
      accessorFn: (row) => formatMarketLabel(row),
      cell: (info) => (
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {formatMarketLabel(info.row.original)}
        </span>
      ),
    },
    {
      id: "direction",
      header: "Dir",
      accessorFn: (row) =>
        resolveTradeDirection({
          direction: row.side,
          instrumentType: row.instrument_type,
          optionRight: effectiveOptionRight(row, optionOverrides),
          symbol: row.symbol,
          markMissingOptionRight: true,
        }).sortKey,
      meta: { label: "Direction", headerTitle: "Direction — long/short, call/put when option" },
      cell: (info) => {
        const trade = info.row.original;
        return (
          <DirCell
            direction={trade.side}
            instrumentType={trade.instrument_type}
            optionRight={effectiveOptionRight(trade, optionOverrides)}
            symbol={trade.symbol}
            markMissingOptionRight
          />
        );
      },
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
      header: "P&L",
      meta: { align: "right" },
      cell: (info) => <ReturnCell value={info.getValue<number>()} currency={currency} />,
    },
  ];

  if (onEdit) {
    columns.push({
      id: "actions",
      header: "",
      enableSorting: false,
      meta: { align: "right" },
      cell: (info) => (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Edit ${info.row.original.symbol}`}
          title="Edit trade"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(info.row.original);
          }}
        >
          <Pencil size={12} strokeWidth={1.75} />
        </Button>
      ),
    });
  }

  return columns;
}
