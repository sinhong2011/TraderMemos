import type { ColumnDef } from "@tanstack/react-table";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { Trade } from "../lib/api/types";
import { usePrivacyMode } from "../lib/displayPrefs";
import { fmtDateShort, fmtDuration, fmtMoney, fmtSignedMoney } from "../lib/format";
import { intlLocale } from "../lib/locale";
import { Pill, type PillTone } from "./Pill";
import { pnlColor } from "./theme-tokens";
import { TradeRowMenu, type TradeRowActions } from "./TradeRowMenu";

export type { TradeRowActions };

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

/** Conventional contract size when Trade list payloads omit fill multipliers. */
export function tradeNotionalMultiplier(instrumentType: string): number {
  return instrumentType === "option" ? 100 : 1;
}

export function tradeNotional(qty: number, price: number, instrumentType: string): number {
  return qty * price * tradeNotionalMultiplier(instrumentType);
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

function MoneyCell({
  value,
  currency,
  fxRate = 1,
}: {
  value: number | null;
  currency: string;
  fxRate?: number;
}) {
  usePrivacyMode();
  if (value == null) return muted("-");
  return <span className="tabular-nums">{fmtMoney(value * fxRate, currency, intlLocale())}</span>;
}

function SignedMoneyCell({
  value,
  currency,
  fxRate = 1,
}: {
  value: number;
  currency: string;
  fxRate?: number;
}) {
  usePrivacyMode();
  return (
    <span className={`tabular-nums font-semibold ${pnlColor(value)}`}>
      {fmtSignedMoney(value * fxRate, currency, intlLocale())}
    </span>
  );
}

export function tradeColumns(
  currency: string,
  actions: TradeRowActions,
  fxRate = 1,
): ColumnDef<Trade>[] {
  return [
    {
      accessorKey: "opened_at",
      header: "Date",
      meta: { label: "Created At", headerTitle: "Date opened" },
      cell: (i) => muted(fmtDateShort(i.getValue<string>())),
    },
    {
      accessorKey: "symbol",
      header: "Symbol",
      meta: { label: "Symbol" },
      cell: (i) => <span className="font-semibold text-accent">{i.getValue<string>()}</span>,
    },
    {
      id: "status",
      header: "Status",
      enableSorting: false,
      meta: { label: "Status", headerTitle: "Trade result" },
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
      header: "Dir",
      meta: { label: "Direction", headerTitle: "Direction — long or short" },
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
      header: "Market",
      meta: { label: "Market", headerTitle: "Instrument type" },
      cell: (i) => (
        <Pill tone="muted" title={MARKET_TITLES[i.getValue<string>()]}>
          {marketLabel(i.getValue<string>())}
        </Pill>
      ),
    },
    {
      accessorKey: "qty_opened",
      header: "Qty",
      meta: { align: "right", label: "Qty", headerTitle: "Quantity opened" },
      cell: (i) => <span className="tabular-nums">{i.getValue<number>().toFixed(2)}</span>,
    },
    {
      accessorKey: "avg_entry_price",
      header: "Entry",
      meta: { align: "right", label: "Entry", headerTitle: "Average entry price" },
      cell: (i) => <MoneyCell value={i.getValue<number>()} currency={currency} fxRate={fxRate} />,
    },
    {
      accessorKey: "avg_exit_price",
      header: "Exit",
      meta: { align: "right", label: "Exit", headerTitle: "Average exit price" },
      cell: (i) => (
        <MoneyCell value={i.getValue<number | null>()} currency={currency} fxRate={fxRate} />
      ),
    },
    {
      id: "ent_tot",
      header: "Ent tot",
      enableSorting: false,
      meta: {
        align: "right",
        label: "Entry total",
        headerTitle: "Entry total — quantity × average entry × multiplier",
      },
      cell: (i) => {
        const t = i.row.original;
        return (
          <MoneyCell
            value={tradeNotional(t.qty_opened, t.avg_entry_price, t.instrument_type)}
            currency={currency}
            fxRate={fxRate}
          />
        );
      },
    },
    {
      id: "ext_tot",
      header: "Ext tot",
      enableSorting: false,
      meta: {
        align: "right",
        label: "Exit total",
        headerTitle: "Exit total — quantity × average exit × multiplier",
      },
      cell: (i) => {
        const t = i.row.original;
        return t.avg_exit_price == null ? (
          muted("-")
        ) : (
          <MoneyCell
            value={tradeNotional(t.qty_opened, t.avg_exit_price, t.instrument_type)}
            currency={currency}
            fxRate={fxRate}
          />
        );
      },
    },
    {
      id: "pos",
      header: "Pos",
      enableSorting: false,
      meta: { align: "right", label: "Position", headerTitle: "Position still open" },
      cell: (i) => {
        const t = i.row.original;
        if (t.status !== "open") return muted("-");
        const qty = t.qty_remaining > 0 ? t.qty_remaining : t.qty_opened;
        return <span className="tabular-nums">{qty.toFixed(2)}</span>;
      },
    },
    {
      accessorKey: "time_in_trade_secs",
      header: "Hold",
      meta: { align: "right", label: "Hold", headerTitle: "Time in trade" },
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
      header: "Return",
      meta: { align: "right", label: "Return", headerTitle: "Net P&L" },
      cell: (i) => {
        const v = i.getValue<number | null>();
        if (v == null) return muted("-");
        return <SignedMoneyCell value={v} currency={currency} fxRate={fxRate} />;
      },
    },
    {
      accessorKey: "return_pct",
      header: "Return %",
      meta: {
        align: "right",
        label: "Return %",
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
      enableHiding: false,
      cell: (i) => <TradeRowMenu trade={i.row.original} actions={actions} />,
    },
  ];
}

/** Sortable trade columns for the tablecn-style Sort button. */
export const TRADE_SORT_COLUMNS: { id: string; label: string }[] = [
  { id: "opened_at", label: "Created At" },
  { id: "symbol", label: "Symbol" },
  { id: "direction", label: "Direction" },
  { id: "instrument_type", label: "Market" },
  { id: "qty_opened", label: "Qty" },
  { id: "avg_entry_price", label: "Entry" },
  { id: "avg_exit_price", label: "Exit" },
  { id: "time_in_trade_secs", label: "Hold" },
  { id: "net_pnl", label: "Return" },
  { id: "return_pct", label: "Return %" },
];

/** Hideable trade columns for the tablecn-style View button. */
export const TRADE_VIEW_COLUMNS: { id: string; label: string }[] = [
  { id: "opened_at", label: "Created At" },
  { id: "symbol", label: "Symbol" },
  { id: "status", label: "Status" },
  { id: "direction", label: "Direction" },
  { id: "instrument_type", label: "Market" },
  { id: "qty_opened", label: "Qty" },
  { id: "avg_entry_price", label: "Entry" },
  { id: "avg_exit_price", label: "Exit" },
  { id: "ent_tot", label: "Entry total" },
  { id: "ext_tot", label: "Exit total" },
  { id: "pos", label: "Position" },
  { id: "time_in_trade_secs", label: "Hold" },
  { id: "net_pnl", label: "Return" },
  { id: "return_pct", label: "Return %" },
];
