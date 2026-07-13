import { ChevronDown, FileStack, Plus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { Modal, ModalBanner } from "../../components/Modal";
import { Pill } from "../../components/Pill";
import { SegmentedControl } from "../../components/SegmentedControl";
import { SignalDatePicker } from "../../components/SignalDatePicker";
import { SignalField } from "../../components/SignalField";
import { SignalInput } from "../../components/SignalInput";
import { SignalSelect } from "../../components/SignalSelect";
import { useToastManager } from "../../components/Toast";
import { attachmentsApi } from "../../lib/api/attachments";
import { cashApi } from "../../lib/api/cash";
import { tradesApi } from "../../lib/api/trades";
import { useFilters, normalizeFilterDate } from "../../lib/filters";
import {
	buildJournalNotes,
	computeInitialRisk,
	EMOTIONAL_STATES,
	weightedAvgEntry,
} from "../../lib/newTradeJournal";
import { localDateString } from "../../lib/dateRangePresets";
import { checkTradeCompliance } from "../../lib/tradeCompliance";
import {
	listTradeTemplates,
	saveTradeTemplate,
	type TradeTemplate,
} from "../../lib/tradeTemplates";
import { useAccounts } from "../../lib/hooks/useAccounts";
import { useSummary } from "../../lib/hooks/useAnalytics";
import {
	ExecutionBatchError,
	useCreateExecutions,
} from "../../lib/hooks/useExecutions";
import { useRiskRules } from "../../lib/hooks/useRiskRules";
import { useSetups } from "../../lib/hooks/useSetups";
import { useTags } from "../../lib/hooks/useTags";
import { useTrades } from "../../lib/hooks/useTrades";
import { useUI } from "../../lib/ui";
import { cn } from "../../lib/cn";

const MARKETS = [
	{ value: "stock", label: "STOCK" },
	{ value: "option", label: "OPTION" },
	{ value: "crypto", label: "CRYPTO" },
	{ value: "futures", label: "FUTURES" },
	{ value: "forex", label: "FOREX" },
];

type Tab = "general" | "journal" | "dividends";

interface Row {
	side: "buy" | "sell";
	executed_at: string;
	quantity: string;
	price: string;
	fees: string;
}

const rowSchema = z.object({
	side: z.enum(["buy", "sell"]),
	executed_at: z.string().min(1),
	quantity: z.coerce.number().positive("qty must be > 0"),
	price: z.coerce.number().positive("price must be > 0"),
	fees: z.coerce.number().min(0),
});

const labelClass =
	"mb-1 block text-[10px] font-medium uppercase tracking-widest text-text-dim";

const inputClass =
	"w-full rounded-control border border-border bg-bg-inset px-2.5 py-2 text-xs text-text outline-none placeholder:text-text-dim";

const btnGhost =
	"cursor-pointer rounded-control border border-border bg-bg-elevated px-2.5 py-1.5 text-[11px] font-medium text-text-muted transition-colors hover:bg-bg-hover hover:text-text disabled:cursor-not-allowed disabled:opacity-50";

const btnPrimary =
	"cursor-pointer rounded-control border-none bg-accent px-3.5 py-1.5 text-xs font-semibold text-bg disabled:cursor-not-allowed disabled:opacity-50";

function nowLocal(): string {
	const d = new Date();
	d.setSeconds(0, 0);
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function todayDate(): string {
	const d = new Date();
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function emptyRow(side: "buy" | "sell"): Row {
	return { side, executed_at: nowLocal(), quantity: "", price: "", fees: "" };
}

function parseNum(v: string): number | null {
	if (!v.trim()) return null;
	const n = Number(v);
	return Number.isFinite(n) ? n : null;
}

const RATING_OPTS = [1, 2, 3, 4, 5].map((n) => ({
	value: String(n),
	label: String(n),
}));

export function NewTradeDrawer() {
	const open = useUI((s) => s.modal === "new-trade");
	const closeModal = useUI((s) => s.closeModal);
	const filterAccountId = useFilters((s) => s.accountId);
	const accounts = useAccounts().data ?? [];
	const setups = useSetups().data ?? [];
	const allTags = useTags().data ?? [];
	const mistakeTags = useMemo(
		() => allTags.filter((t) => t.kind === "mistake"),
		[allTags],
	);
	const regularTags = useMemo(
		() => allTags.filter((t) => t.kind !== "mistake"),
		[allTags],
	);
	const toast = useToastManager();
	const createExecutions = useCreateExecutions();
	const riskRulesQ = useRiskRules();
	const today = localDateString(new Date());
	const todayFilters = useMemo(
		() => ({
			account_id: filterAccountId,
			from: normalizeFilterDate(today, "start"),
			to: normalizeFilterDate(today, "end"),
		}),
		[filterAccountId, today],
	);
	const todaySummaryQ = useSummary(todayFilters);
	const openTradesQ = useTrades({
		account_id: filterAccountId,
		status: "open",
	});
	const openRiskTotal = useMemo(() => {
		const trades = openTradesQ.data ?? [];
		return trades.reduce((sum, t) => {
			const r = t.initial_risk;
			return sum + (r != null && r > 0 ? r : 0);
		}, 0);
	}, [openTradesQ.data]);

	const [tab, setTab] = useState<Tab>("general");
	const [accountId, setAccountId] = useState("");
	const [copyAccountIds, setCopyAccountIds] = useState<string[]>([]);
	const [market, setMarket] = useState("stock");
	const [symbol, setSymbol] = useState("");
	const [side, setSide] = useState<"long" | "short">("long");
	const [target, setTarget] = useState("");
	const [stop, setStop] = useState("");
	const [rows, setRows] = useState<Row[]>([emptyRow("buy")]);
	const [setupId, setSetupId] = useState("");
	const [emotionalState, setEmotionalState] = useState("");
	const [confidence, setConfidence] = useState("3");
	const [tradeQuality, setTradeQuality] = useState("3");
	const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
	const [selectedMistakeIds, setSelectedMistakeIds] = useState<string[]>([]);
	const [notes, setNotes] = useState("");
	const [pendingFiles, setPendingFiles] = useState<File[]>([]);
	const [dividendAmount, setDividendAmount] = useState("");
	const [dividendDate, setDividendDate] = useState(todayDate());
	const [dividendNote, setDividendNote] = useState("");
	const [error, setError] = useState("");
	const [templatesOpen, setTemplatesOpen] = useState(false);
	const [copyOpen, setCopyOpen] = useState(false);
	const [templates, setTemplates] = useState<TradeTemplate[]>([]);

	const effectiveAccountId =
		accountId || filterAccountId || accounts[0]?.id || "";
	const currency =
		accounts.find((a) => a.id === effectiveAccountId)?.base_currency ?? "USD";

	const wasOpen = useRef(false);

	function resetForm() {
		setTab("general");
		setAccountId("");
		setCopyAccountIds([]);
		setMarket("stock");
		setSymbol("");
		setSide("long");
		setTarget("");
		setStop("");
		setRows([emptyRow("buy")]);
		setSetupId("");
		setEmotionalState("");
		setConfidence("3");
		setTradeQuality("3");
		setSelectedTagIds([]);
		setSelectedMistakeIds([]);
		setNotes("");
		setPendingFiles([]);
		setDividendAmount("");
		setDividendDate(todayDate());
		setDividendNote("");
		setError("");
		setTemplatesOpen(false);
		setCopyOpen(false);
	}

	function close() {
		resetForm();
		closeModal();
	}

	const consumeTradeDraft = useUI((s) => s.consumeTradeDraft);

	useEffect(() => {
		if (open && !wasOpen.current) {
			resetForm();
			setTemplates(listTradeTemplates());
			const draft = consumeTradeDraft();
			if (draft) {
				if (draft.symbol) setSymbol(draft.symbol);
				if (draft.side) {
					setSide(draft.side);
					setRows([emptyRow(draft.side === "long" ? "buy" : "sell")]);
				}
				if (draft.target) setTarget(draft.target);
				if (draft.stop) setStop(draft.stop);
				if (draft.setupId) setSetupId(draft.setupId);
				if (draft.notes) setNotes(draft.notes);
			}
		}
		wasOpen.current = open;
	}, [open, consumeTradeDraft]);

	function updateRow(i: number, patch: Partial<Row>) {
		setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
	}

	function toggleId(list: string[], id: string, set: (v: string[]) => void) {
		set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
	}

	function applyTemplate(t: TradeTemplate) {
		setMarket(t.market);
		setSymbol(t.symbol);
		setSide(t.side);
		setTarget(t.target);
		setStop(t.stop);
		setRows(
			t.rows.map((r) => ({
				...r,
				executed_at: nowLocal(),
			})),
		);
		setSetupId(t.setupId);
		setNotes(t.notes);
		setEmotionalState(t.emotionalState);
		setConfidence(String(t.confidence || 3));
		setTradeQuality(String(t.tradeQuality || 3));
		setSelectedTagIds(t.tagIds);
		setSelectedMistakeIds(t.mistakeTagIds);
		setTemplatesOpen(false);
	}

	function handleSaveTemplate() {
		const name = window.prompt("Template name");
		if (!name?.trim()) return;
		saveTradeTemplate({
			name: name.trim(),
			market,
			symbol,
			side,
			target,
			stop,
			rows: rows.map(({ side, quantity, price, fees }) => ({
				side,
				quantity,
				price,
				fees,
			})),
			setupId,
			notes,
			emotionalState,
			confidence: Number(confidence) || 3,
			tradeQuality: Number(tradeQuality) || 3,
			tagIds: selectedTagIds,
			mistakeTagIds: selectedMistakeIds,
		});
		setTemplates(listTradeTemplates());
		toast.add({ title: "Template saved", description: name.trim() });
	}

	const parsedRows = useMemo(() => {
		const out: z.infer<typeof rowSchema>[] = [];
		for (const r of rows) {
			const p = rowSchema.safeParse(r);
			if (p.success) out.push(p.data);
		}
		return out;
	}, [rows]);

	const entry = useMemo(
		() => weightedAvgEntry(parsedRows, side),
		[parsedRows, side],
	);

	const initialRisk = useMemo(() => {
		if (!entry) return null;
		return computeInitialRisk(side, entry.avg, entry.qty, parseNum(stop));
	}, [entry, side, stop]);

	function runCompliance() {
		const rules = riskRulesQ.data;
		const result = checkTradeCompliance({
			side,
			entryPrice: entry?.avg ?? null,
			qty: entry?.qty ?? null,
			targetPrice: parseNum(target),
			stopPrice: parseNum(stop),
			initialRisk,
			rules: rules
				? {
						max_risk_per_trade: rules.max_risk_per_trade,
						max_daily_loss: rules.max_daily_loss,
						max_open_risk: rules.max_open_risk,
					}
				: undefined,
			todayNetPnl: todaySummaryQ.data?.net_pnl ?? null,
			openRiskTotal,
		});
		if (result.passed) {
			toast.add({
				title: "Compliance check passed",
				description:
					result.warnings.join(" ") ||
					"Plan looks consistent with your risk rules.",
			});
		} else {
			toast.add({
				title: "Compliance issues found",
				description: [...result.issues, ...result.warnings].join(" "),
			});
		}
		setError(result.issues[0] ?? "");
	}

	async function save() {
		setError("");
		if (!effectiveAccountId) {
			setError("account is required");
			return;
		}
		if (!symbol.trim()) {
			setError("symbol is required");
			setTab("general");
			return;
		}
		if (parsedRows.length === 0) {
			setError("add at least one valid execution row");
			setTab("general");
			return;
		}

		const accountIds = [
			effectiveAccountId,
			...copyAccountIds.filter((id) => id !== effectiveAccountId),
		];

		const executionRows = parsedRows.map((r) => ({
			symbol: symbol.toUpperCase(),
			instrument_type: market,
			side: r.side,
			quantity: r.quantity,
			price: r.price,
			fees: r.fees,
			executed_at: new Date(r.executed_at).toISOString(),
		}));

		try {
			const { tradeIds } = await createExecutions.mutateAsync({
				accountIds,
				rows: executionRows,
			});

			const journalNotes = buildJournalNotes({ notes });

			const patchBody = {
				notes: journalNotes,
				setup_id: setupId || "",
				initial_risk: initialRisk ?? undefined,
				target_price: parseNum(target) ?? undefined,
				stop_price: parseNum(stop) ?? undefined,
				emotional_state: emotionalState || "",
				confidence: Number(confidence) || undefined,
				trade_quality: Number(tradeQuality) || undefined,
				tag_ids: [...selectedTagIds, ...selectedMistakeIds],
			};

			for (const tradeId of tradeIds) {
				await tradesApi.patch(tradeId, patchBody);
			}

			const primaryTradeId = tradeIds[0];
			if (primaryTradeId && pendingFiles.length > 0) {
				for (const file of pendingFiles.slice(0, 5)) {
					const fd = new FormData();
					fd.append("file", file);
					await attachmentsApi.upload(primaryTradeId, fd);
				}
			}

			const divAmount = parseNum(dividendAmount);
			if (primaryTradeId && divAmount != null && divAmount > 0) {
				const signed =
					side === "short" ? -Math.abs(divAmount) : Math.abs(divAmount);
				await cashApi.create({
					account_id: effectiveAccountId,
					type: "dividend",
					amount: signed,
					currency,
					occurred_at: new Date(`${dividendDate}T12:00:00`).toISOString(),
					note: dividendNote || `${symbol.toUpperCase()} dividend`,
					trade_id: primaryTradeId,
				});
			}

			toast.add({
				title: "Trade logged",
				description: `${symbol.toUpperCase()} saved${copyAccountIds.length ? ` (+${copyAccountIds.length} copies)` : ""}.`,
			});
			close();
		} catch (e) {
			if (e instanceof ExecutionBatchError) {
				const message = e.failures
					.map((f) => `Row ${f.index + 1} (${f.accountId}): ${f.message}`)
					.join("; ");
				setError(message);
				toast.add({ title: "Could not log trade", description: message });
			} else {
				const message = e instanceof Error ? e.message : "Save failed";
				setError(message);
				toast.add({ title: "Could not log trade", description: message });
			}
		}
	}

	const otherAccounts = accounts.filter((a) => a.id !== effectiveAccountId);
	const pending = createExecutions.isPending;

	const headerActions = (
		<>
			<div className="relative">
				<button
					type="button"
					className={btnGhost}
					onClick={() => {
						setTemplates(listTradeTemplates());
						setTemplatesOpen((v) => !v);
						setCopyOpen(false);
					}}
				>
					<span className="inline-flex items-center gap-1">
						<FileStack size={12} />
						Templates
						<ChevronDown size={12} />
					</span>
				</button>
				{templatesOpen && (
					<div className="absolute right-0 top-[calc(100%+4px)] z-50 min-w-[180px] rounded-control border border-border bg-bg-panel py-1 shadow-hard">
						{templates.length === 0 ? (
							<p className="px-3 py-2 text-[11px] text-text-muted">No templates</p>
						) : (
							templates.map((t) => (
								<button
									key={t.id}
									type="button"
									className="block w-full cursor-pointer border-none bg-transparent px-3 py-1.5 text-left text-xs text-text hover:bg-bg-hover"
									onClick={() => applyTemplate(t)}
								>
									{t.name}
								</button>
							))
						)}
						<button
							type="button"
							className="block w-full cursor-pointer border-none border-t border-border bg-transparent px-3 py-1.5 text-left text-[11px] text-accent hover:bg-bg-hover"
							onClick={handleSaveTemplate}
						>
							Save current as template…
						</button>
					</div>
				)}
			</div>
			{otherAccounts.length > 0 && (
				<div className="relative">
					<button
						type="button"
						className={btnGhost}
						onClick={() => {
							setCopyOpen((v) => !v);
							setTemplatesOpen(false);
						}}
					>
						<span className="inline-flex items-center gap-1">
							Save copies to
							<ChevronDown size={12} />
						</span>
					</button>
					{copyOpen && (
						<div className="absolute right-0 top-[calc(100%+4px)] z-50 min-w-[200px] rounded-control border border-border bg-bg-panel p-2 shadow-hard">
							{otherAccounts.map((a) => (
								<label
									key={a.id}
									className="flex cursor-pointer items-center gap-2 rounded-sharp px-2 py-1.5 text-xs text-text hover:bg-bg-hover"
								>
									<input
										type="checkbox"
										checked={copyAccountIds.includes(a.id)}
										onChange={() =>
											toggleId(copyAccountIds, a.id, setCopyAccountIds)
										}
									/>
									{a.name}
								</label>
							))}
						</div>
					)}
				</div>
			)}
		</>
	);

	const footer = (
		<div className="flex w-full items-center justify-between gap-3">
			<div className="flex gap-2">
				<button
					type="button"
					className={btnPrimary}
					onClick={save}
					disabled={pending}
				>
					Save
				</button>
				<button
					type="button"
					className={btnGhost}
					onClick={runCompliance}
					disabled={pending}
				>
					Check compliance
				</button>
			</div>
			<button type="button" className={btnGhost} onClick={close} disabled={pending}>
				Cancel
			</button>
		</div>
	);

	return (
		<Modal
			open={open}
			onOpenChange={(o) => {
				if (!o && !pending) close();
			}}
			title="New Trade"
			headerActions={headerActions}
			footer={footer}
		>
			<ModalBanner>
				Log any trade you've entered — still open, partially exited, or fully
				closed. Add buy/sell executions, journal notes, and run a compliance
				check against your risk plan.
			</ModalBanner>

			<SegmentedControl
				ariaLabel="Trade form section"
				options={[
					{ value: "general", label: "General" },
					{ value: "journal", label: "Journal" },
					{ value: "dividends", label: "Dividends" },
				]}
				value={tab}
				onChange={(v) => setTab(v as Tab)}
			/>

			{tab === "general" && (
				<>
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
						<div>
							<label className={labelClass} htmlFor="nt-account">
								Account
							</label>
							<SignalSelect
								id="nt-account"
								value={effectiveAccountId}
								onValueChange={setAccountId}
								options={accounts.map((a) => ({ value: a.id, label: a.name }))}
								ariaLabel="Account"
								triggerClassName="h-9 text-[12px]"
							/>
						</div>
						<div>
							<label className={labelClass} htmlFor="nt-market">
								Market
							</label>
							<SignalSelect
								id="nt-market"
								value={market}
								onValueChange={setMarket}
								options={MARKETS}
								ariaLabel="Market"
								triggerClassName="h-9 text-[12px]"
							/>
						</div>
						<div>
							<label className={labelClass} htmlFor="nt-symbol">
								Symbol
							</label>
							<input
								id="nt-symbol"
								aria-label="Symbol"
								value={symbol}
								onChange={(e) => setSymbol(e.target.value.toUpperCase())}
								placeholder="AAPL"
								className={inputClass}
							/>
						</div>
						<div>
							<span className={labelClass}>Side</span>
							<SegmentedControl
								ariaLabel="Side"
								options={[
									{ value: "long", label: "↗ LONG" },
									{ value: "short", label: "↘ SHORT" },
								]}
								value={side}
								onChange={(v) => {
									const next = v as "long" | "short";
									setSide(next);
									setRows((rs) =>
										rs.map((r, i) =>
											i === 0
												? {
														...r,
														side: next === "long" ? "buy" : "sell",
													}
												: r,
										),
									);
								}}
							/>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<div>
							<label className={labelClass} htmlFor="nt-target">
								Target
							</label>
							<input
								id="nt-target"
								inputMode="decimal"
								value={target}
								onChange={(e) => setTarget(e.target.value)}
								placeholder="Optional"
								className={inputClass}
							/>
						</div>
						<div>
							<label className={labelClass} htmlFor="nt-stop">
								Stop
							</label>
							<input
								id="nt-stop"
								inputMode="decimal"
								value={stop}
								onChange={(e) => setStop(e.target.value)}
								placeholder="Optional"
								className={inputClass}
							/>
						</div>
					</div>

					{initialRisk != null && (
						<p className="text-[10px] text-text-muted">
							Planned risk: ${initialRisk.toFixed(2)}
						</p>
					)}

					<div className="flex flex-col gap-2">
						<div
							className="grid gap-2 text-[10px] font-medium uppercase tracking-widest text-text-dim"
							style={{ gridTemplateColumns: "72px 1fr 80px 90px 72px 28px" }}
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
								className="grid items-center gap-2"
								style={{
									gridTemplateColumns: "72px 1fr 80px 90px 72px 28px",
								}}
							>
								<button
									type="button"
									aria-label={`Toggle action row ${i + 1}`}
									onClick={() =>
										updateRow(i, {
											side: row.side === "buy" ? "sell" : "buy",
										})
									}
									className={cn(
										"cursor-pointer rounded-full border-none py-1 text-[11px] font-bold",
										row.side === "buy"
											? "bg-[var(--tint-pos)] text-pos"
											: "bg-[var(--tint-neg)] text-loss",
									)}
								>
									{row.side.toUpperCase()}
								</button>
								<input
									type="datetime-local"
									aria-label={`Date/time row ${i + 1}`}
									value={row.executed_at}
									onChange={(e) =>
										updateRow(i, { executed_at: e.target.value })
									}
									className={inputClass}
								/>
								<input
									inputMode="decimal"
									aria-label={`Qty row ${i + 1}`}
									placeholder="Qty"
									value={row.quantity}
									onChange={(e) => updateRow(i, { quantity: e.target.value })}
									className={inputClass}
								/>
								<input
									inputMode="decimal"
									aria-label={`Price row ${i + 1}`}
									placeholder="Price"
									value={row.price}
									onChange={(e) => updateRow(i, { price: e.target.value })}
									className={inputClass}
								/>
								<input
									inputMode="decimal"
									aria-label={`Fee row ${i + 1}`}
									placeholder="Fee"
									value={row.fees}
									onChange={(e) => updateRow(i, { fees: e.target.value })}
									className={inputClass}
								/>
								<button
									type="button"
									aria-label={`Remove row ${i + 1}`}
									disabled={rows.length === 1}
									onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
									className="flex cursor-pointer border-none bg-transparent p-0 text-text-muted disabled:opacity-40"
								>
									<X size={14} />
								</button>
							</div>
						))}
						<button
							type="button"
							aria-label="Add execution row"
							onClick={() =>
								setRows((rs) => [
									...rs,
									emptyRow(side === "long" ? "buy" : "sell"),
								])
							}
							className="mx-auto mt-1 flex size-8 cursor-pointer items-center justify-center rounded-full border-none bg-accent text-bg"
						>
							<Plus size={16} />
						</button>
					</div>
				</>
			)}

			{tab === "journal" && (
				<div className="flex flex-col gap-4">
					<div>
						<label className={labelClass} htmlFor="nt-setup">
							Setup
						</label>
						<SignalSelect
							id="nt-setup"
							value={setupId}
							onValueChange={setSetupId}
							options={[
								{ value: "", label: "None" },
								...setups.map((s) => ({ value: s.id, label: s.name })),
							]}
							ariaLabel="Setup"
							triggerClassName="h-9 text-[12px]"
						/>
					</div>
					<div>
						<label className={labelClass} htmlFor="nt-emotion">
							Emotional state
						</label>
						<SignalSelect
							id="nt-emotion"
							value={emotionalState}
							onValueChange={setEmotionalState}
							options={[
								{ value: "", label: "Not set" },
								...EMOTIONAL_STATES.map((s) => ({ value: s, label: s })),
							]}
							ariaLabel="Emotional state"
							triggerClassName="h-9 text-[12px]"
						/>
					</div>
					{regularTags.length > 0 && (
						<div>
							<span className={labelClass}>Tags</span>
							<div className="flex flex-wrap gap-1.5">
								{regularTags.map((t) => {
									const on = selectedTagIds.includes(t.id);
									return (
										<button
											key={t.id}
											type="button"
											onClick={() =>
												toggleId(selectedTagIds, t.id, setSelectedTagIds)
											}
											className="cursor-pointer border-none bg-transparent p-0"
										>
											<Pill tone={on ? "accent" : "muted"}>{t.name}</Pill>
										</button>
									);
								})}
							</div>
						</div>
					)}
					{mistakeTags.length > 0 && (
						<div>
							<span className={labelClass}>Mistakes</span>
							<p className="mb-2 text-[10px] text-text-muted">
								Optional — tap any that apply. None are added by default.
							</p>
							<div className="flex flex-wrap gap-1.5">
								{mistakeTags.map((t) => {
									const on = selectedMistakeIds.includes(t.id);
									return (
										<button
											key={t.id}
											type="button"
											onClick={() =>
												toggleId(
													selectedMistakeIds,
													t.id,
													setSelectedMistakeIds,
												)
											}
											className="cursor-pointer border-none bg-transparent p-0"
										>
											<Pill tone={on ? "neg" : "muted"}>{t.name}</Pill>
										</button>
									);
								})}
							</div>
						</div>
					)}
					<div>
						<span className={labelClass}>Confidence</span>
						<SegmentedControl
							ariaLabel="Confidence"
							options={RATING_OPTS}
							value={confidence}
							onChange={setConfidence}
						/>
					</div>
					<div>
						<span className={labelClass}>Trade quality</span>
						<p className="mb-2 text-[10px] text-text-muted">
							How well you executed your plan, rated after the trade.
						</p>
						<SegmentedControl
							ariaLabel="Trade quality"
							options={RATING_OPTS}
							value={tradeQuality}
							onChange={setTradeQuality}
						/>
					</div>
					<div>
						<label className={labelClass} htmlFor="nt-notes">
							Notes
						</label>
						<textarea
							id="nt-notes"
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							rows={5}
							placeholder="What was the thesis? What would you do differently?"
							className={`${inputClass} resize-y`}
						/>
					</div>
					<div>
						<span className={labelClass}>
							Screenshots ({pendingFiles.length}/5)
						</span>
						<input
							type="file"
							accept="image/*"
							multiple
							onChange={(e) => {
								const files = [...(e.target.files ?? [])].slice(
									0,
									5 - pendingFiles.length,
								);
								setPendingFiles((f) => [...f, ...files].slice(0, 5));
								e.target.value = "";
							}}
							className="text-xs text-text-muted"
						/>
						{pendingFiles.length > 0 && (
							<ul className="mt-2 space-y-1 text-[11px] text-text-muted">
								{pendingFiles.map((f) => (
									<li key={f.name}>{f.name}</li>
								))}
							</ul>
						)}
					</div>
				</div>
			)}

			{tab === "dividends" && (
				<div className="flex flex-col gap-4">
					<p className="text-xs leading-relaxed text-text-muted">
						Track dividend payouts on this position. Amount rolls into trade
						total P&amp;L (shorts are recorded as a debit). Win/Loss and R stay
						price-based.
					</p>
					<div className="grid grid-cols-2 gap-3">
						<SignalField label={`Amount (${currency})`} htmlFor="nt-div-amt">
							<SignalInput
								id="nt-div-amt"
								inputMode="decimal"
								value={dividendAmount}
								onChange={(e) => setDividendAmount(e.target.value)}
								placeholder="0.00"
							/>
						</SignalField>
						<SignalField label="Date">
							<SignalDatePicker
								id="nt-div-date"
								aria-label="Date"
								value={dividendDate}
								onChange={setDividendDate}
							/>
						</SignalField>
					</div>
					<SignalField label="Note" htmlFor="nt-div-note">
						<SignalInput
							id="nt-div-note"
							value={dividendNote}
							onChange={(e) => setDividendNote(e.target.value)}
							placeholder="Optional"
						/>
					</SignalField>
				</div>
			)}

			{error && <p className="text-xs text-loss">{error}</p>}
		</Modal>
	);
}
