import { ArrowLeft, Paperclip, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EmptyState } from "../../components/EmptyState";
import { Panel } from "../../components/Panel";
import { Skeleton } from "../../components/Skeleton";
import { pnlColor } from "../../components/theme-tokens";
import { getToken } from "../../lib/api/client";
import type {
	Execution,
	Setup,
	Tag,
	TradeAttachment,
	TradeDetail,
} from "../../lib/api/types";
import { fmtMoney, fmtSignedMoney } from "../../lib/format";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOCALE = "en-US";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(iso: string | null): string {
	if (!iso) return "-";
	return new Date(iso).toLocaleDateString(LOCALE, {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

function fmtDateTime(iso: string): string {
	return new Date(iso).toLocaleString(LOCALE, {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function fmtBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// AuthedImage - fetches file through the api client (which adds Bearer token)
// and renders via object URL so the <img> tag doesn't need auth headers.
// ---------------------------------------------------------------------------

interface AuthedImageProps {
	attachmentId: string;
	filename: string;
}

function AuthedImage({ attachmentId, filename }: AuthedImageProps) {
	const [src, setSrc] = useState<string | null>(null);
	const [error, setError] = useState(false);

	useEffect(() => {
		let objectUrl: string | null = null;
		// Fetch the image with an Authorization header (plain <img> cannot send headers).
		// getToken() reads the stored Bearer token from the client module.
		const t = getToken();
		const BASE = (import.meta.env.VITE_API as string) ?? "/api/v1";
		fetch(`${BASE}/attachments/${attachmentId}/file`, {
			headers: t ? { Authorization: `Bearer ${t}` } : {},
		})
			.then((r) => {
				if (!r.ok) throw new Error(`${r.status}`);
				return r.blob();
			})
			.then((blob) => {
				objectUrl = URL.createObjectURL(blob);
				setSrc(objectUrl);
			})
			.catch(() => setError(true));
		return () => {
			if (objectUrl) URL.revokeObjectURL(objectUrl);
		};
	}, [attachmentId]);

	if (error) {
		return (
			<div
				className="flex items-center justify-center text-xs rounded"
				style={{
					width: "100%",
					aspectRatio: "16/9",
					background: "var(--color-surface-hover)",
					color: "var(--color-text-muted)",
				}}
			>
				{filename}
			</div>
		);
	}

	if (!src) {
		return <Skeleton height="120px" />;
	}

	return (
		<img
			src={src}
			alt={filename}
			className="w-full rounded object-cover"
			style={{ maxHeight: "200px" }}
		/>
	);
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

interface TradeHeaderProps {
	trade: TradeDetail;
	onBack?: () => void;
}

function TradeHeader({ trade, onBack }: TradeHeaderProps) {
	const currency = trade.pnl_currency;
	const pnl = trade.net_pnl;
	const rMultiple = trade.r_multiple;
	const returnPct = trade.return_pct;

	return (
		<div
			className="flex flex-col gap-3 px-4 py-4"
			style={{
				background: "var(--color-surface-panel)",
				border: "1px solid var(--color-border)",
				borderRadius: "var(--radius-panel)",
			}}
		>
			{/* Back + breadcrumb row */}
			{onBack && (
				<button
					type="button"
					onClick={onBack}
					className="flex items-center gap-1 text-xs w-fit"
					style={{
						color: "var(--color-text-muted)",
						background: "none",
						border: "none",
						cursor: "pointer",
						padding: 0,
					}}
				>
					<ArrowLeft size={13} strokeWidth={1.5} />
					Back to trades
				</button>
			)}

			{/* Main header row */}
			<div className="flex flex-wrap items-start justify-between gap-4">
				{/* Symbol + direction */}
				<div className="flex items-center gap-3">
					<span
						className="text-2xl font-bold tabular-nums tracking-tight"
						style={{
							color: "var(--color-text)",
							fontFamily: "var(--font-mono)",
						}}
					>
						{trade.symbol}
					</span>
					<span
						className="text-xs font-semibold uppercase px-2 py-0.5 rounded"
						style={{
							background:
								trade.direction === "long"
									? "rgba(82,202,150,0.15)"
									: "rgba(235,75,104,0.15)",
							color:
								trade.direction === "long"
									? "var(--color-pos)"
									: "var(--color-neg)",
							border: `1px solid ${trade.direction === "long" ? "rgba(82,202,150,0.3)" : "rgba(235,75,104,0.3)"}`,
						}}
					>
						{trade.direction}
					</span>
					<span
						className="text-xs uppercase"
						style={{ color: "var(--color-text-muted)" }}
					>
						{trade.instrument_type}
					</span>
				</div>

				{/* P&L block */}
				<div className="flex items-baseline gap-4">
					{pnl != null && (
						<span
							className={`text-2xl font-bold tabular-nums ${pnlColor(pnl)}`}
							style={{ fontFamily: "var(--font-mono)" }}
						>
							{fmtSignedMoney(pnl, currency, LOCALE)}
						</span>
					)}
					{returnPct != null && (
						<span className={`text-sm tabular-nums ${pnlColor(returnPct)}`}>
							{returnPct >= 0 ? "+" : ""}
							{returnPct.toFixed(2)}%
						</span>
					)}
					{rMultiple != null && (
						<span
							className={`text-sm tabular-nums ${pnlColor(rMultiple)}`}
							title="R-multiple"
						>
							{rMultiple >= 0 ? "+" : ""}
							{rMultiple.toFixed(2)}R
						</span>
					)}
				</div>
			</div>

			{/* Metadata row */}
			<div
				className="flex flex-wrap gap-5 text-xs"
				style={{ color: "var(--color-text-muted)" }}
			>
				<span>
					<span className="uppercase mr-1" style={{ opacity: 0.6 }}>
						Opened
					</span>
					<span className="tabular-nums" style={{ color: "var(--color-text)" }}>
						{fmtDate(trade.opened_at)}
					</span>
				</span>
				<span>
					<span className="uppercase mr-1" style={{ opacity: 0.6 }}>
						Closed
					</span>
					<span className="tabular-nums" style={{ color: "var(--color-text)" }}>
						{fmtDate(trade.closed_at)}
					</span>
				</span>
				<span>
					<span className="uppercase mr-1" style={{ opacity: 0.6 }}>
						Qty
					</span>
					<span className="tabular-nums" style={{ color: "var(--color-text)" }}>
						{trade.qty_opened}
					</span>
				</span>
				<span>
					<span className="uppercase mr-1" style={{ opacity: 0.6 }}>
						Entry
					</span>
					<span className="tabular-nums" style={{ color: "var(--color-text)" }}>
						{fmtMoney(trade.avg_entry_price, currency, LOCALE)}
					</span>
				</span>
				{trade.avg_exit_price != null && (
					<span>
						<span className="uppercase mr-1" style={{ opacity: 0.6 }}>
							Exit
						</span>
						<span
							className="tabular-nums"
							style={{ color: "var(--color-text)" }}
						>
							{fmtMoney(trade.avg_exit_price, currency, LOCALE)}
						</span>
					</span>
				)}
				<span>
					<span className="uppercase mr-1" style={{ opacity: 0.6 }}>
						Fees
					</span>
					<span className="tabular-nums" style={{ color: "var(--color-text)" }}>
						{fmtMoney(trade.fees_total, currency, LOCALE)}
					</span>
				</span>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Fills table
// ---------------------------------------------------------------------------

interface FillsTableProps {
	fills: Execution[];
	currency: string;
}

function FillsTable({ fills, currency }: FillsTableProps) {
	if (fills.length === 0) {
		return (
			<EmptyState
				title="No fills"
				hint="Executions will appear here once imported."
			/>
		);
	}

	return (
		<div className="overflow-auto">
			<table
				className="w-full border-collapse"
				style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}
			>
				<thead>
					<tr style={{ background: "var(--color-surface-panel)" }}>
						{["Side", "Qty", "Price", "Fees", "Executed"].map((h) => (
							<th
								key={h}
								className="px-3 py-2 text-left font-medium"
								style={{
									color: "var(--color-text-muted)",
									borderBottom: "1px solid var(--color-border)",
									whiteSpace: "nowrap",
								}}
							>
								{h}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{fills.map((fill) => (
						<tr key={fill.id}>
							<td
								className="px-3 py-1.5"
								style={{
									color:
										fill.side === "buy"
											? "var(--color-pos)"
											: "var(--color-neg)",
									borderBottom: "1px solid var(--color-border)",
								}}
							>
								{fill.side.toUpperCase()}
							</td>
							<td
								className="px-3 py-1.5 tabular-nums"
								style={{
									color: "var(--color-text)",
									borderBottom: "1px solid var(--color-border)",
								}}
							>
								{fill.quantity}
							</td>
							<td
								className="px-3 py-1.5 tabular-nums"
								style={{
									color: "var(--color-text)",
									borderBottom: "1px solid var(--color-border)",
								}}
							>
								{fmtMoney(fill.price, currency, LOCALE)}
							</td>
							<td
								className="px-3 py-1.5 tabular-nums"
								style={{
									color: "var(--color-text-muted)",
									borderBottom: "1px solid var(--color-border)",
								}}
							>
								{fmtMoney(fill.fees + fill.commission, currency, LOCALE)}
							</td>
							<td
								className="px-3 py-1.5 tabular-nums"
								style={{
									color: "var(--color-text-muted)",
									borderBottom: "1px solid var(--color-border)",
									whiteSpace: "nowrap",
								}}
							>
								{fmtDateTime(fill.executed_at)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Journal panel (right column)
// ---------------------------------------------------------------------------

export interface JournalFormState {
	notes: string;
	setup_id: string;
	initial_risk: string;
	tag_ids: string[];
}

export interface JournalPanelProps {
	initialState: JournalFormState;
	setups: Setup[];
	customTags: Tag[];
	mistakeTags: Tag[];
	saving: boolean;
	onSave: (state: JournalFormState) => void;
}

export function JournalPanel({
	initialState,
	setups,
	customTags,
	mistakeTags,
	saving,
	onSave,
}: JournalPanelProps) {
	const [form, setForm] = useState<JournalFormState>(initialState);

	// Sync form if the trade detail re-fetches (e.g. after save)
	const prevInitial = useRef(initialState);
	useEffect(() => {
		if (
			prevInitial.current.notes !== initialState.notes ||
			prevInitial.current.setup_id !== initialState.setup_id ||
			prevInitial.current.initial_risk !== initialState.initial_risk ||
			JSON.stringify(prevInitial.current.tag_ids) !==
				JSON.stringify(initialState.tag_ids)
		) {
			setForm(initialState);
			prevInitial.current = initialState;
		}
	}, [initialState]);

	function toggleTag(id: string) {
		setForm((f) => ({
			...f,
			tag_ids: f.tag_ids.includes(id)
				? f.tag_ids.filter((t) => t !== id)
				: [...f.tag_ids, id],
		}));
	}

	const inputStyle: React.CSSProperties = {
		background: "var(--color-surface-hover)",
		color: "var(--color-text)",
		border: "1px solid var(--color-border)",
		borderRadius: "var(--radius-control)",
		padding: "6px 10px",
		fontSize: "12px",
		fontFamily: "var(--font-ui)",
		outline: "none",
		width: "100%",
	};

	const labelStyle: React.CSSProperties = {
		color: "var(--color-text-muted)",
		fontSize: "11px",
		fontWeight: 500,
		textTransform: "uppercase",
		letterSpacing: "0.04em",
		display: "block",
		marginBottom: "4px",
	};

	return (
		<div className="flex flex-col gap-4 p-4">
			{/* Notes */}
			<div>
				<label htmlFor="trade-notes" style={labelStyle}>
					Notes
				</label>
				<textarea
					id="trade-notes"
					value={form.notes}
					onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
					rows={5}
					placeholder="Write your trade journal entry..."
					style={{
						...inputStyle,
						resize: "vertical",
						lineHeight: 1.5,
					}}
				/>
			</div>

			{/* Setup */}
			<div>
				<label htmlFor="trade-setup" style={labelStyle}>
					Setup
				</label>
				<select
					id="trade-setup"
					value={form.setup_id}
					onChange={(e) => setForm((f) => ({ ...f, setup_id: e.target.value }))}
					style={inputStyle}
				>
					<option value="">None</option>
					{setups.map((s) => (
						<option key={s.id} value={s.id}>
							{s.name}
						</option>
					))}
				</select>
			</div>

			{/* Initial risk */}
			<div>
				<label htmlFor="trade-risk" style={labelStyle}>
					Initial Risk
				</label>
				<input
					id="trade-risk"
					type="number"
					min="0"
					step="0.01"
					value={form.initial_risk}
					onChange={(e) =>
						setForm((f) => ({ ...f, initial_risk: e.target.value }))
					}
					placeholder="0.00"
					style={inputStyle}
				/>
			</div>

			{/* Custom tags */}
			{customTags.length > 0 && (
				<div>
					<span style={labelStyle}>Tags</span>
					<div className="flex flex-col gap-1.5">
						{customTags.map((tag) => (
							<label
								key={tag.id}
								className="flex items-center gap-2 cursor-pointer select-none"
							>
								<input
									type="checkbox"
									checked={form.tag_ids.includes(tag.id)}
									onChange={() => toggleTag(tag.id)}
									style={{ accentColor: "var(--color-accent)" }}
								/>
								<span
									className="text-xs"
									style={{ color: "var(--color-text)" }}
								>
									{tag.name}
								</span>
							</label>
						))}
					</div>
				</div>
			)}

			{/* Mistake tags */}
			{mistakeTags.length > 0 && (
				<div>
					<span style={labelStyle}>Mistakes</span>
					<div className="flex flex-col gap-1.5">
						{mistakeTags.map((tag) => (
							<label
								key={tag.id}
								className="flex items-center gap-2 cursor-pointer select-none"
							>
								<input
									type="checkbox"
									checked={form.tag_ids.includes(tag.id)}
									onChange={() => toggleTag(tag.id)}
									style={{ accentColor: "var(--color-neg)" }}
								/>
								<span
									className="text-xs"
									style={{ color: "var(--color-text)" }}
								>
									{tag.name}
								</span>
							</label>
						))}
					</div>
				</div>
			)}

			{/* Save */}
			<button
				type="button"
				onClick={() => onSave(form)}
				disabled={saving}
				style={{
					background: "var(--color-accent)",
					color: "#fff",
					border: "none",
					borderRadius: "var(--radius-control)",
					padding: "7px 16px",
					fontSize: "12px",
					fontFamily: "var(--font-ui)",
					fontWeight: 600,
					cursor: saving ? "not-allowed" : "pointer",
					opacity: saving ? 0.6 : 1,
					alignSelf: "flex-start",
				}}
			>
				{saving ? "Saving..." : "Save"}
			</button>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Screenshots panel
// ---------------------------------------------------------------------------

interface ScreenshotsPanelProps {
	attachments: TradeAttachment[];
	uploading: boolean;
	onUpload: (file: File) => void;
	onDelete: (attachmentId: string) => void;
}

function ScreenshotsPanel({
	attachments,
	uploading,
	onUpload,
	onDelete,
}: ScreenshotsPanelProps) {
	const fileInputRef = useRef<HTMLInputElement>(null);

	function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (file) {
			onUpload(file);
			// Reset so the same file can be re-selected
			e.target.value = "";
		}
	}

	return (
		<div className="flex flex-col gap-4 p-4">
			{/* Upload control */}
			<div>
				<input
					ref={fileInputRef}
					type="file"
					accept="image/*"
					onChange={handleFileChange}
					style={{ display: "none" }}
					aria-label="Upload screenshot"
				/>
				<button
					type="button"
					onClick={() => fileInputRef.current?.click()}
					disabled={uploading}
					className="flex items-center gap-2"
					style={{
						background: "var(--color-surface-hover)",
						color: uploading ? "var(--color-text-muted)" : "var(--color-text)",
						border: "1px solid var(--color-border)",
						borderRadius: "var(--radius-control)",
						padding: "6px 12px",
						fontSize: "12px",
						fontFamily: "var(--font-ui)",
						cursor: uploading ? "not-allowed" : "pointer",
						opacity: uploading ? 0.6 : 1,
					}}
				>
					<Upload size={13} strokeWidth={1.5} />
					{uploading ? "Uploading..." : "Upload screenshot"}
				</button>
			</div>

			{/* Gallery */}
			{attachments.length === 0 ? (
				<div
					className="flex flex-col items-center justify-center gap-2 py-8 rounded text-xs"
					style={{
						border: "1px dashed var(--color-border)",
						color: "var(--color-text-muted)",
					}}
				>
					<Paperclip size={20} strokeWidth={1.5} style={{ opacity: 0.4 }} />
					No screenshots yet
				</div>
			) : (
				<div className="flex flex-col gap-3">
					{attachments.map((att) => (
						<div key={att.id} className="flex flex-col gap-1">
							{/* Image preview via authed object URL */}
							<AuthedImage attachmentId={att.id} filename={att.filename} />
							{/* Filename + size + delete row */}
							<div className="flex items-center justify-between gap-2">
								<span
									className="text-xs truncate"
									style={{ color: "var(--color-text-muted)" }}
								>
									{att.filename}
									<span className="ml-1 tabular-nums">
										({fmtBytes(att.size_bytes)})
									</span>
								</span>
								<button
									type="button"
									onClick={() => onDelete(att.id)}
									title="Delete screenshot"
									style={{
										background: "none",
										border: "none",
										cursor: "pointer",
										color: "var(--color-text-muted)",
										padding: "2px",
										flexShrink: 0,
									}}
								>
									<Trash2 size={13} strokeWidth={1.5} />
								</button>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// TradeDetailView - pure presentational component
// ---------------------------------------------------------------------------

export interface TradeDetailViewProps {
	trade: TradeDetail | undefined;
	loading: boolean;
	error: boolean;
	setups: Setup[];
	allTags: Tag[];
	attachments: TradeAttachment[];
	attachmentsLoading: boolean;
	saving: boolean;
	uploading: boolean;
	onSave: (state: JournalFormState) => void;
	onUpload: (file: File) => void;
	onDeleteAttachment: (attachmentId: string) => void;
	onBack?: () => void;
}

export function TradeDetailView({
	trade,
	loading,
	error,
	setups,
	allTags,
	attachments,
	saving,
	uploading,
	onSave,
	onUpload,
	onDeleteAttachment,
	onBack,
}: TradeDetailViewProps) {
	// --------------- Loading state ---------------
	if (loading) {
		return (
			<div className="flex flex-col gap-4">
				<Skeleton height="112px" />
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					<Skeleton height="320px" />
					<Skeleton height="320px" />
				</div>
			</div>
		);
	}

	// --------------- Error / not found ---------------
	if (error || !trade) {
		return (
			<EmptyState
				title="Trade not found"
				hint="This trade may have been deleted or the ID is invalid."
			/>
		);
	}

	const customTags = allTags.filter((t) => t.kind === "custom");
	const mistakeTags = allTags.filter((t) => t.kind === "mistake");

	const journalInitial: JournalFormState = {
		notes: trade.notes ?? "",
		setup_id: trade.setup?.id ?? "",
		initial_risk: trade.initial_risk != null ? String(trade.initial_risk) : "",
		tag_ids: (trade.tags ?? []).map((t) => t.id),
	};

	return (
		<div className="flex flex-col gap-4">
			{/* Header */}
			<TradeHeader trade={trade} onBack={onBack} />

			{/* Two-column body */}
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				{/* LEFT - Fills */}
				<div className="flex flex-col gap-4">
					<Panel title={`Fills (${trade.fills.length})`}>
						<FillsTable fills={trade.fills} currency={trade.pnl_currency} />
					</Panel>

					{/* Screenshots below fills on desktop left column */}
					<Panel title="Screenshots">
						<ScreenshotsPanel
							attachments={attachments}
							uploading={uploading}
							onUpload={onUpload}
							onDelete={onDeleteAttachment}
						/>
					</Panel>
				</div>

				{/* RIGHT - Journal */}
				<Panel title="Journal">
					<JournalPanel
						key={trade.id} // re-mount if trade changes
						initialState={journalInitial}
						setups={setups}
						customTags={customTags}
						mistakeTags={mistakeTags}
						saving={saving}
						onSave={onSave}
					/>
				</Panel>
			</div>
		</div>
	);
}
