import type { ColumnDef } from "@tanstack/react-table";
import { ArrowDownRight, ArrowUpRight, MoreHorizontal } from "lucide-react";
import type { Trade } from "../lib/api/types";
import {
	fmtDateShort,
	fmtDuration,
	fmtMoney,
	fmtSignedMoney,
} from "../lib/format";
import { Pill, type PillTone } from "./Pill";
import { pnlColor } from "./theme-tokens";

const LOCALE = "en-US";

const MARKET_LABELS: Record<string, string> = {
	stock: "STK",
	option: "OPT",
	crypto: "CRY",
	futures: "FUT",
	forex: "FX",
};

export function marketLabel(instrumentType: string): string {
	return (
		MARKET_LABELS[instrumentType] ?? instrumentType.slice(0, 3).toUpperCase()
	);
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
	return <span style={{ color: "var(--color-text-muted)" }}>{v}</span>;
}

function money(v: number | null, currency: string) {
	if (v == null) return muted("-");
	return <span className="tabular-nums">{fmtMoney(v, currency, LOCALE)}</span>;
}

export function tradeColumns(
	currency: string,
	onView: (t: Trade) => void,
): ColumnDef<Trade>[] {
	return [
		{
			accessorKey: "opened_at",
			header: "DATE",
			cell: (i) => muted(fmtDateShort(i.getValue<string>())),
		},
		{
			accessorKey: "symbol",
			header: "SYMBOL",
			cell: (i) => (
				<span style={{ color: "var(--color-accent)", fontWeight: 600 }}>
					{i.getValue<string>()}
				</span>
			),
		},
		{
			id: "status",
			header: "STATUS",
			cell: (i) => {
				const s = tradeStatus(i.row.original);
				return <Pill tone={s.tone}>{s.label}</Pill>;
			},
		},
		{
			accessorKey: "direction",
			header: "DIR",
			cell: (i) =>
				i.getValue<string>() === "long" ? (
					<ArrowUpRight
						size={14}
						strokeWidth={2}
						style={{ color: "var(--color-pos)" }}
						aria-label="long"
					/>
				) : (
					<ArrowDownRight
						size={14}
						strokeWidth={2}
						style={{ color: "var(--color-neg)" }}
						aria-label="short"
					/>
				),
		},
		{
			accessorKey: "instrument_type",
			header: "MARKET",
			cell: (i) => (
				<Pill tone="muted">{marketLabel(i.getValue<string>())}</Pill>
			),
		},
		{
			accessorKey: "qty_opened",
			header: "QTY",
			cell: (i) => (
				<span className="tabular-nums">{i.getValue<number>().toFixed(2)}</span>
			),
		},
		{
			accessorKey: "avg_entry_price",
			header: "ENTRY",
			cell: (i) => money(i.getValue<number>(), currency),
		},
		{
			accessorKey: "avg_exit_price",
			header: "EXIT",
			cell: (i) => money(i.getValue<number | null>(), currency),
		},
		{
			id: "ent_tot",
			header: "ENT TOT",
			cell: (i) => {
				const t = i.row.original;
				return money(t.qty_opened * t.avg_entry_price, currency);
			},
		},
		{
			id: "ext_tot",
			header: "EXT TOT",
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
			cell: (i) => {
				const v = i.getValue<number | null>();
				return v == null || v <= 0 ? (
					muted("-")
				) : (
					<Pill tone="accent">{fmtDuration(v)}</Pill>
				);
			},
		},
		{
			accessorKey: "net_pnl",
			header: "RETURN",
			cell: (i) => {
				const v = i.getValue<number | null>();
				if (v == null) return muted("-");
				return (
					<span className={`tabular-nums font-semibold ${pnlColor(v)}`}>
						{fmtSignedMoney(v, currency, LOCALE)}
					</span>
				);
			},
		},
		{
			accessorKey: "return_pct",
			header: "RETURN %",
			cell: (i) => {
				const v = i.getValue<number | null>();
				if (v == null) return muted("-");
				return (
					<span className={`tabular-nums ${pnlColor(v)}`}>{v.toFixed(2)}%</span>
				);
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
					style={{
						background: "none",
						border: "none",
						cursor: "pointer",
						color: "var(--color-text-muted)",
						padding: 2,
						display: "flex",
					}}
				>
					<MoreHorizontal size={14} strokeWidth={1.5} />
				</button>
			),
		},
	];
}
