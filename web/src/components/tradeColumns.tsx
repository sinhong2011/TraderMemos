import type { ColumnDef, ColumnPinningState } from "@/lib/table";
import type { Trade } from "@/lib/api/types";
import { usePrivacyMode } from "@/lib/displayPrefs";
import { fmtDuration, fmtMoney, fmtSignedMoney, fmtTradeDay } from "@/lib/format";
import { intlLocale } from "@/lib/locale";
import { resolveTradeDirection } from "@/lib/tradeDirection";
import { DirCell } from "./DirCell";
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

/** Net P&L ÷ planned risk when journal initial_risk is set. */
export function tradeRMultiple(t: Trade): number | null {
  if (t.initial_risk == null || t.initial_risk <= 0 || t.net_pnl == null) return null;
  return t.net_pnl / t.initial_risk;
}

function muted(v: string) {
  return <span className="text-muted-foreground">{v}</span>;
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
      accessorKey: "symbol",
      header: "Symbol",
      meta: { label: "Symbol", minWidth: 72 },
      cell: (i) => <span className="font-semibold text-primary">{i.getValue<string>()}</span>,
    },
    {
      id: "status",
      accessorFn: (row) => tradeStatus(row).label,
      header: "Status",
      meta: { label: "Status", headerTitle: "Trade result", minWidth: 64 },
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
      id: "direction",
      accessorFn: (row) =>
        resolveTradeDirection({
          direction: row.direction,
          instrumentType: row.instrument_type,
          symbol: row.symbol,
        }).sortKey,
      header: "Dir",
      meta: {
        label: "Direction",
        headerTitle: "Direction — long/short; LC/LP/SC/SP when option",
        minWidth: 52,
      },
      cell: (i) => {
        const t = i.row.original;
        return (
          <DirCell direction={t.direction} instrumentType={t.instrument_type} symbol={t.symbol} />
        );
      },
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
      meta: { align: "right", label: "Qty", headerTitle: "Quantity opened", minWidth: 64 },
      cell: (i) => <span className="tabular-nums">{i.getValue<number>().toFixed(2)}</span>,
    },
    {
      accessorKey: "avg_entry_price",
      header: "Entry",
      meta: { align: "right", label: "Entry", headerTitle: "Average entry price", minWidth: 80 },
      cell: (i) => <MoneyCell value={i.getValue<number>()} currency={currency} fxRate={fxRate} />,
    },
    {
      accessorKey: "avg_exit_price",
      header: "Exit",
      meta: { align: "right", label: "Exit", headerTitle: "Average exit price", minWidth: 80 },
      cell: (i) => (
        <MoneyCell value={i.getValue<number | null>()} currency={currency} fxRate={fxRate} />
      ),
    },
    {
      id: "ent_tot",
      accessorFn: (row) => tradeNotional(row.qty_opened, row.avg_entry_price, row.instrument_type),
      header: "Ent tot",
      meta: {
        align: "right",
        label: "Entry total",
        headerTitle: "Entry total — quantity × average entry × multiplier",
        minWidth: 88,
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
      accessorFn: (row) =>
        row.avg_exit_price == null
          ? null
          : tradeNotional(row.qty_opened, row.avg_exit_price, row.instrument_type),
      header: "Ext tot",
      meta: {
        align: "right",
        label: "Exit total",
        headerTitle: "Exit total — quantity × average exit × multiplier",
        minWidth: 88,
      },
      sortFn: (a, b, id) => {
        const av = a.getValue<number | null>(id);
        const bv = b.getValue<number | null>(id);
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return av === bv ? 0 : av < bv ? -1 : 1;
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
      accessorFn: (row) => {
        if (row.status !== "open") return null;
        return row.qty_remaining > 0 ? row.qty_remaining : row.qty_opened;
      },
      header: "Pos",
      meta: { align: "right", label: "Position", headerTitle: "Position still open", minWidth: 56 },
      sortFn: (a, b, id) => {
        const av = a.getValue<number | null>(id);
        const bv = b.getValue<number | null>(id);
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return av === bv ? 0 : av < bv ? -1 : 1;
      },
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
      meta: { align: "right", label: "Hold", headerTitle: "Time in trade", minWidth: 56 },
      cell: (i) => {
        const v = i.getValue<number | null>();
        return v == null || v <= 0 ? (
          muted("-")
        ) : (
          <span className="tabular-nums text-muted-foreground">{fmtDuration(v)}</span>
        );
      },
    },
    {
      accessorKey: "fees_total",
      header: "Fees",
      meta: {
        align: "right",
        label: "Fees",
        headerTitle: "Total fees and commissions",
        minWidth: 72,
      },
      cell: (i) => <MoneyCell value={i.getValue<number>()} currency={currency} fxRate={fxRate} />,
    },
    {
      accessorKey: "net_pnl",
      header: "P&L",
      meta: { align: "right", label: "P&L", headerTitle: "Net P&L", minWidth: 112 },
      cell: (i) => {
        const v = i.getValue<number | null>();
        if (v == null) return muted("-");
        return <SignedMoneyCell value={v} currency={currency} fxRate={fxRate} />;
      },
    },
    {
      accessorKey: "return_pct",
      header: "P&L %",
      meta: {
        align: "right",
        label: "P&L %",
        headerTitle: "Net P&L as a percentage of entry total",
        minWidth: 88,
      },
      cell: (i) => {
        const v = i.getValue<number | null>();
        if (v == null) return muted("-");
        return <span className={`tabular-nums ${pnlColor(v)}`}>{v.toFixed(2)}%</span>;
      },
    },
    {
      accessorKey: "opened_at",
      header: "Date",
      meta: { label: "Created At", headerTitle: "Date opened", minWidth: 96 },
      cell: (i) => muted(fmtTradeDay(i.getValue<string>())),
    },
    {
      accessorKey: "closed_at",
      header: "Close",
      meta: { label: "Close date", headerTitle: "Date closed (last activity)", minWidth: 96 },
      cell: (i) => {
        const v = i.getValue<string | null>();
        return v ? muted(fmtTradeDay(v)) : muted("-");
      },
    },
    {
      id: "r_multiple",
      accessorFn: (row) => tradeRMultiple(row),
      header: "R",
      meta: {
        align: "right",
        label: "R",
        headerTitle: "Net P&L ÷ planned risk (initial risk)",
        minWidth: 56,
      },
      cell: (i) => {
        const v = i.getValue<number | null>();
        if (v == null) return muted("-");
        const sign = v > 0 ? "+" : "";
        return (
          <span className={`tabular-nums font-semibold ${pnlColor(v)}`}>
            {sign}
            {v.toFixed(2)}R
          </span>
        );
      },
    },
    {
      id: "tags",
      accessorFn: (row) => row.tags.map((t) => t.name).join(", "),
      header: "Tags",
      enableSorting: false,
      meta: { label: "Tags", headerTitle: "Trade tags", minWidth: 96 },
      cell: (i) => {
        const tags = i.row.original.tags;
        if (tags.length === 0) return muted("-");
        const shown = tags.slice(0, 2);
        const rest = tags.length - shown.length;
        return (
          <div className="flex max-w-[10rem] flex-wrap items-center gap-1">
            {shown.map((t) => (
              <Pill key={t.id} tone={t.kind === "mistake" ? "neg" : "muted"} title={t.name}>
                {t.name}
              </Pill>
            ))}
            {rest > 0 ? muted(`+${rest}`) : null}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      enableHiding: false,
      meta: { minWidth: 48 },
      cell: (i) => <TradeRowMenu trade={i.row.original} actions={actions} />,
    },
  ];
}

/** Pin the actions column via TanStack `columnPinning` (pass to DataTable). */
export const TRADE_COLUMN_PINNING: ColumnPinningState = { start: [], end: ["actions"] };

/** Sortable trade columns for the tablecn-style Sort button. */
export const TRADE_SORT_COLUMNS: { id: string; label: string }[] = [
  { id: "opened_at", label: "Created At" },
  { id: "closed_at", label: "Close date" },
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
  { id: "fees_total", label: "Fees" },
  { id: "net_pnl", label: "P&L" },
  { id: "return_pct", label: "P&L %" },
  { id: "r_multiple", label: "R" },
];

/** Hideable trade columns for the tablecn-style View button. */
export const TRADE_VIEW_COLUMNS: { id: string; label: string }[] = [
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
  { id: "fees_total", label: "Fees" },
  { id: "net_pnl", label: "P&L" },
  { id: "return_pct", label: "P&L %" },
  { id: "opened_at", label: "Created At" },
  { id: "closed_at", label: "Close date" },
  { id: "r_multiple", label: "R" },
  { id: "tags", label: "Tags" },
];
