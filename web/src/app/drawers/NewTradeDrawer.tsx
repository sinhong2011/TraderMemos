import { Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Drawer, DrawerBanner } from "../../components/Drawer";
import { SegmentedControl } from "../../components/SegmentedControl";
import { useToastManager } from "../../components/Toast";
import { useFilters } from "../../lib/filters";
import { useAccounts } from "../../lib/hooks/useAccounts";
import {
	ExecutionBatchError,
	useCreateExecutions,
} from "../../lib/hooks/useExecutions";
import { useUI } from "../../lib/ui";

const MARKETS = [
	{ value: "stock", label: "Stock" },
	{ value: "option", label: "Option" },
	{ value: "crypto", label: "Crypto" },
	{ value: "futures", label: "Futures" },
	{ value: "forex", label: "Forex" },
];

interface Row {
	side: "buy" | "sell";
	executed_at: string; // datetime-local value
	quantity: string;
	price: string;
	fees: string;
}

const rowSchema = z.object({
	side: z.enum(["buy", "sell"]),
	executed_at: z.string().min(1, "date/time is required"),
	quantity: z.coerce.number().positive("qty must be > 0"),
	price: z.coerce.number().positive("price must be > 0"),
	fees: z.coerce.number().min(0, "fee must be >= 0"),
});

const formSchema = z.object({
	account_id: z.string().min(1, "account is required"),
	symbol: z.string().trim().min(1, "symbol is required"),
	instrument_type: z.string().min(1),
	rows: z.array(rowSchema).min(1),
});

function nowLocal(): string {
	const d = new Date();
	d.setSeconds(0, 0);
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function emptyRow(side: "buy" | "sell"): Row {
	return { side, executed_at: nowLocal(), quantity: "", price: "", fees: "" };
}

const inputStyle: React.CSSProperties = {
	background: "var(--color-surface-raised)",
	color: "var(--color-text)",
	border: "1px solid var(--color-border)",
	borderRadius: "var(--radius-control)",
	padding: "7px 10px",
	fontSize: 13,
	fontFamily: "var(--font-ui)",
	outline: "none",
	width: "100%",
};

const labelStyle: React.CSSProperties = {
	fontSize: 11,
	fontWeight: 600,
	textTransform: "uppercase",
	letterSpacing: "0.04em",
	color: "var(--color-text-muted)",
};

export function NewTradeDrawer() {
	const open = useUI((s) => s.drawer === "new-trade");
	const closeDrawer = useUI((s) => s.closeDrawer);
	const filterAccountId = useFilters((s) => s.accountId);
	const accounts = useAccounts().data ?? [];
	const toast = useToastManager();
	const createExecutions = useCreateExecutions();

	const [accountId, setAccountId] = useState("");
	const [market, setMarket] = useState("stock");
	const [symbol, setSymbol] = useState("");
	const [side, setSide] = useState<"long" | "short">("long");
	const [rows, setRows] = useState<Row[]>([emptyRow("buy")]);
	const [error, setError] = useState("");

	const effectiveAccountId =
		accountId || filterAccountId || accounts[0]?.id || "";

	function reset() {
		setAccountId("");
		setMarket("stock");
		setSymbol("");
		setSide("long");
		setRows([emptyRow("buy")]);
		setError("");
	}

	function close() {
		reset();
		closeDrawer();
	}

	// The drawer stays mounted in the shell, so the initial `rows` state (and
	// its captured nowLocal() timestamp) goes stale between opens. Reset
	// whenever the drawer transitions from closed to open.
	const wasOpen = useRef(false);
	useEffect(() => {
		if (open && !wasOpen.current) {
			setAccountId("");
			setMarket("stock");
			setSymbol("");
			setSide("long");
			setRows([emptyRow("buy")]);
			setError("");
		}
		wasOpen.current = open;
	}, [open]);

	function updateRow(i: number, patch: Partial<Row>) {
		setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
	}

	async function save() {
		setError("");
		const parsed = formSchema.safeParse({
			account_id: effectiveAccountId,
			symbol,
			instrument_type: market,
			rows,
		});
		if (!parsed.success) {
			setError(parsed.error.issues[0].message);
			return;
		}
		const bodies = parsed.data.rows.map((r) => ({
			account_id: parsed.data.account_id,
			symbol: parsed.data.symbol.toUpperCase(),
			instrument_type: parsed.data.instrument_type,
			side: r.side,
			quantity: r.quantity,
			price: r.price,
			fees: r.fees,
			executed_at: new Date(r.executed_at).toISOString(),
		}));
		try {
			await createExecutions.mutateAsync(bodies);
			toast.add({
				title: "Trade logged",
				description: `${bodies.length} execution(s) saved for ${bodies[0].symbol}.`,
			});
			close();
		} catch (e) {
			if (e instanceof ExecutionBatchError) {
				// Keep only the failed rows in the form so a retry is targeted.
				const failedIdx = new Set(e.failures.map((f) => f.index));
				setRows((rs) => rs.filter((_, i) => failedIdx.has(i)));
				// Number errors by post-filter position so they match what the
				// user now sees (retained rows are exactly the failed ones, in order).
				setError(
					e.failures
						.map((f, j) => `Execution ${j + 1} failed: ${f.message}`)
						.join("; "),
				);
			} else {
				setError(e instanceof Error ? e.message : "Save failed");
			}
		}
	}

	const footer = (
		<>
			<button
				type="button"
				onClick={close}
				disabled={createExecutions.isPending}
				style={{
					background: "var(--color-surface-raised)",
					color: "var(--color-text)",
					border: "1px solid var(--color-border)",
					borderRadius: "var(--radius-control)",
					padding: "7px 14px",
					fontSize: 13,
					cursor: createExecutions.isPending ? "default" : "pointer",
					opacity: createExecutions.isPending ? 0.6 : 1,
				}}
			>
				Cancel
			</button>
			<button
				type="button"
				onClick={save}
				disabled={createExecutions.isPending}
				style={{
					background: "var(--color-accent)",
					color: "#0e1218",
					border: "none",
					borderRadius: "var(--radius-control)",
					padding: "7px 16px",
					fontSize: 13,
					fontWeight: 600,
					cursor: createExecutions.isPending ? "default" : "pointer",
					opacity: createExecutions.isPending ? 0.6 : 1,
				}}
			>
				Save
			</button>
		</>
	);

	return (
		<Drawer
			open={open}
			onOpenChange={(o) => {
				if (!o && !createExecutions.isPending) close();
			}}
			title="New Trade"
			footer={footer}
		>
			<DrawerBanner>
				Log any trade you've entered — still open, partially exited, or fully
				closed. Add buy/sell executions; the journal groups them into a trade
				automatically.
			</DrawerBanner>

			<div className="grid grid-cols-2 gap-3">
				<div className="flex flex-col gap-1">
					<label htmlFor="nt-account" style={labelStyle}>
						Account
					</label>
					<select
						id="nt-account"
						value={effectiveAccountId}
						onChange={(e) => setAccountId(e.target.value)}
						style={inputStyle}
					>
						{accounts.map((a) => (
							<option key={a.id} value={a.id}>
								{a.name}
							</option>
						))}
					</select>
				</div>
				<div className="flex flex-col gap-1">
					<label htmlFor="nt-market" style={labelStyle}>
						Market
					</label>
					<select
						id="nt-market"
						value={market}
						onChange={(e) => setMarket(e.target.value)}
						style={inputStyle}
					>
						{MARKETS.map((m) => (
							<option key={m.value} value={m.value}>
								{m.label}
							</option>
						))}
					</select>
				</div>
			</div>

			<div className="grid grid-cols-2 gap-3">
				<div className="flex flex-col gap-1">
					<label htmlFor="nt-symbol" style={labelStyle}>
						Symbol
					</label>
					<input
						id="nt-symbol"
						aria-label="Symbol"
						value={symbol}
						onChange={(e) => setSymbol(e.target.value.toUpperCase())}
						placeholder="e.g. AAPL"
						style={inputStyle}
					/>
				</div>
				<div className="flex flex-col gap-1">
					<span style={labelStyle}>Side</span>
					<SegmentedControl
						ariaLabel="Side"
						options={[
							{ value: "long", label: "↗ LONG" },
							{ value: "short", label: "↘ SHORT" },
						]}
						value={side}
						onChange={(v) => setSide(v as "long" | "short")}
					/>
				</div>
			</div>

			<div className="flex flex-col gap-2">
				<div
					className="grid gap-2"
					style={{
						gridTemplateColumns: "72px 1fr 90px 100px 90px 28px",
						...labelStyle,
					}}
				>
					<span>Action</span>
					<span>Date / Time</span>
					<span>Qty</span>
					<span>Price</span>
					<span>Fee</span>
					<span />
				</div>
				{rows.map((row, i) => (
					<div
						key={i}
						className="grid gap-2 items-center"
						style={{ gridTemplateColumns: "72px 1fr 90px 100px 90px 28px" }}
					>
						<button
							type="button"
							aria-label={`Toggle action row ${i + 1}`}
							onClick={() =>
								updateRow(i, { side: row.side === "buy" ? "sell" : "buy" })
							}
							style={{
								padding: "5px 0",
								fontSize: 11,
								fontWeight: 700,
								border: "none",
								borderRadius: 999,
								cursor: "pointer",
								color:
									row.side === "buy" ? "var(--color-pos)" : "var(--color-neg)",
								background:
									row.side === "buy" ? "var(--tint-pos)" : "var(--tint-neg)",
							}}
						>
							{row.side.toUpperCase()}
						</button>
						<input
							type="datetime-local"
							aria-label={`Date/time row ${i + 1}`}
							value={row.executed_at}
							onChange={(e) => updateRow(i, { executed_at: e.target.value })}
							style={inputStyle}
						/>
						<input
							inputMode="decimal"
							aria-label={`Qty row ${i + 1}`}
							placeholder="Qty"
							value={row.quantity}
							onChange={(e) => updateRow(i, { quantity: e.target.value })}
							style={inputStyle}
						/>
						<input
							inputMode="decimal"
							aria-label={`Price row ${i + 1}`}
							placeholder="Price"
							value={row.price}
							onChange={(e) => updateRow(i, { price: e.target.value })}
							style={inputStyle}
						/>
						<input
							inputMode="decimal"
							aria-label={`Fee row ${i + 1}`}
							placeholder="Fee"
							value={row.fees}
							onChange={(e) => updateRow(i, { fees: e.target.value })}
							style={inputStyle}
						/>
						<button
							type="button"
							aria-label={`Remove row ${i + 1}`}
							disabled={rows.length === 1}
							onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
							style={{
								background: "none",
								border: "none",
								cursor: rows.length === 1 ? "default" : "pointer",
								color: "var(--color-text-muted)",
								opacity: rows.length === 1 ? 0.4 : 1,
								display: "flex",
							}}
						>
							<X size={14} strokeWidth={1.5} />
						</button>
					</div>
				))}
				<button
					type="button"
					aria-label="Add execution row"
					onClick={() =>
						setRows((rs) => [...rs, emptyRow(side === "long" ? "buy" : "sell")])
					}
					style={{
						alignSelf: "center",
						width: 32,
						height: 32,
						borderRadius: 999,
						border: "none",
						background: "var(--color-accent)",
						color: "#0e1218",
						cursor: "pointer",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						marginTop: 4,
					}}
				>
					<Plus size={16} strokeWidth={2} />
				</button>
			</div>

			{error && (
				<p className="text-xs" style={{ color: "var(--color-neg)" }}>
					{error}
				</p>
			)}
		</Drawer>
	);
}
