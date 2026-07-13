import type { ColumnDef } from "@tanstack/react-table";
import { ArrowDownRight, ArrowUpRight, MoreHorizontal } from "lucide-react";
import type { Trade } from "../lib/api/types";
import { fmtDateShort, fmtDuration, fmtMoney, fmtSignedMoney } from "../lib/format";
import { intlLocale } from "../lib/locale";
import { Pill, type PillTone } from "./Pill";
import { pnlColor } from "./theme-tokens";

const MARKET_LABELS: Record<string, string> = {
  stock: "STK",
  option: "OPT",
  crypto: "CRY",
  futures: "FUT",
  forex: "FX",
};

const MARKET_TITLES: Record<string, string> = {
  stock: "Stock",
  option: "Option",
  crypto: "Crypto",
  futures: "Futures",
  forex: "Forex",
};

export function marketLabel(instrumentType: string): string {
  return MARKET_LABELS[instrumentType] ?? instrumentType.slice(0, 3).toUpperCase();
}

export function tradeStatus(t: Trade): {
  label: "WIN" | "LOSS" | "OPEN" | "BE";
  tone: PillTone;
} {
  if (t.status === "open") return { label: "OPEN", tone: "accent" };
  if (t.net_pnl != null && t.net_pnl > 0) return { label: "WIN", tone: "pos" };
  if (t.net_pnl != null && t.net_pnl < 0) return { label: "LOSS", tone: "neg" };
  return { label: "BE", tone: "muted" };
}

function muted(v: string) {
  return <span className="text-text-muted">{v}</span>;
}

function money(v: number | null, currency: string) {
  if (v == null) return muted("-");
  return <span className="tabular-nums">{fmtMoney(v, currency, intlLocale())}</span>;
}

export function tradeColumns(currency: string, onView: (t: Trade) => void): ColumnDef<Trade>[] {
  return [
    {
      accessorKey: "opened_at",
      header: "DATE",
      meta: { headerTitle: "Date opened" },
      cell: (i) => muted(fmtDateShort(i.getValue<string>())),
    },
    {
      accessorKey: "symbol",
      header: "SYMBOL",
      cell: (i) => <span className="font-semibold text-accent">{i.getValue<string>()}</span>,
    },
    {
      id: "status",
      header: "STATUS",
      meta: { headerTitle: "Trade result" },
      cell: (i) => {
        const s = tradeStatus(i.row.original);
        return (
          <Pill tone={s.tone} title={s.label === "BE" ? "Break-even" : undefined}>
            {s.label}
          </Pill>
        );
      },
    },
    {
      accessorKey: "direction",
      header: "DIR",
      meta: { headerTitle: "Direction — long or short" },
      cell: (i) =>
        i.getValue<string>() === "long" ? (
          <ArrowUpRight
            size={14}
            strokeWidth={2}
            className="text-text-muted"
            role="img"
            aria-label="long"
          />
        ) : (
          <ArrowDownRight
            size={14}
            strokeWidth={2}
            className="text-text-muted"
            role="img"
            aria-label="short"
          />
        ),
    },
    {
      accessorKey: "instrument_type",
      header: "MARKET",
      meta: { headerTitle: "Instrument type" },
      cell: (i) => (
        <Pill tone="muted" title={MARKET_TITLES[i.getValue<string>()]}>
          {marketLabel(i.getValue<string>())}
        </Pill>
      ),
    },
    {
      accessorKey: "qty_opened",
      header: "QTY",
      meta: { align: "right", headerTitle: "Quantity opened" },
      cell: (i) => <span className="tabular-nums">{i.getValue<number>().toFixed(2)}</span>,
    },
    {
      accessorKey: "avg_entry_price",
      header: "ENTRY",
      meta: { align: "right", headerTitle: "Average entry price" },
      cell: (i) => money(i.getValue<number>(), currency),
    },
    {
      accessorKey: "avg_exit_price",
      header: "EXIT",
      meta: { align: "right", headerTitle: "Average exit price" },
      cell: (i) => money(i.getValue<number | null>(), currency),
    },
    {
      id: "ent_tot",
      header: "ENT TOT",
      meta: {
        align: "right",
        headerTitle: "Entry total — quantity × average entry",
      },
      cell: (i) => {
        const t = i.row.original;
        return money(t.qty_opened * t.avg_entry_price, currency);
      },
    },
    {
      id: "ext_tot",
      header: "EXT TOT",
      meta: {
        align: "right",
        headerTitle: "Exit total — quantity × average exit",
      },
      cell: (i) => {
        const t = i.row.original;
        return t.avg_exit_price == null
          ? muted("-")
          : money(t.qty_opened * t.avg_exit_price, currency);
      },
    },
    {
      id: "pos",
      header: "POS",
      meta: { align: "right", headerTitle: "Position still open" },
      cell: (i) => {
        const t = i.row.original;
        if (t.status !== "open") return muted("-");
        const qty = t.qty_remaining > 0 ? t.qty_remaining : t.qty_opened;
        return <span className="tabular-nums">{qty.toFixed(2)}</span>;
      },
    },
    {
      accessorKey: "time_in_trade_secs",
      header: "HOLD",
      meta: { align: "right", headerTitle: "Time in trade" },
      cell: (i) => {
        const v = i.getValue<number | null>();
        return v == null || v <= 0 ? (
          muted("-")
        ) : (
          <span className="tabular-nums text-text-muted">{fmtDuration(v)}</span>
        );
      },
    },
    {
      accessorKey: "net_pnl",
      header: "RETURN",
      meta: { align: "right", headerTitle: "Net P&L" },
      cell: (i) => {
        const v = i.getValue<number | null>();
        if (v == null) return muted("-");
        return (
          <span className={`tabular-nums font-semibold ${pnlColor(v)}`}>
            {fmtSignedMoney(v, currency, intlLocale())}
          </span>
        );
      },
    },
    {
      accessorKey: "return_pct",
      header: "RETURN %",
      meta: {
        align: "right",
        headerTitle: "Net P&L as a percentage of entry total",
      },
      cell: (i) => {
        const v = i.getValue<number | null>();
        if (v == null) return muted("-");
        return <span className={`tabular-nums ${pnlColor(v)}`}>{v.toFixed(2)}%</span>;
      },
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: (i) => (
        <button
          type="button"
          aria-label={`View ${i.row.original.symbol}`}
          onClick={(e) => {
            e.stopPropagation();
            onView(i.row.original);
          }}
          className="-my-2 flex h-9 w-9 cursor-pointer items-center justify-center rounded-control text-text-muted transition-colors hover:bg-bg-hover hover:text-text focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
        >
          <MoreHorizontal size={14} strokeWidth={1.5} />
        </button>
      ),
    },
  ];
}
