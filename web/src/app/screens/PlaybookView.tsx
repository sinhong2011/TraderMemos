import { BookOpen, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { Page } from "../../components/Page";
import { Skeleton } from "../../components/Skeleton";
import { pnlColor } from "../../components/theme-tokens";
import type { BreakGroup, Setup } from "../../lib/api/types";
import type { SetupBody } from "../../lib/api/setups";
import { fmtPct, fmtSignedMoney } from "../../lib/format";
import { useUI } from "../../lib/ui";
import { intlLocale } from "../../lib/locale";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlaybookViewProps {
	setups: Setup[];
	setupsLoading: boolean;
	setupsError: boolean;
	breakdown: BreakGroup[];
	breakdownLoading: boolean;
	currency: string;
	onCreate: (body: SetupBody) => Promise<void>;
	onUpdate: (id: string, body: SetupBody) => Promise<void>;
	onDelete: (id: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getGroupForSetup(
	breakdown: BreakGroup[],
	setupName: string,
): BreakGroup | undefined {
	return breakdown.find((g) => g.key === setupName);
}

// ---------------------------------------------------------------------------
// Inline form for creating / editing
// ---------------------------------------------------------------------------

interface SetupFormProps {
	initialName?: string;
	initialDescription?: string;
	onSave: (name: string, description: string) => Promise<void>;
	onCancel: () => void;
	saveLabel: string;
}

function SetupForm({
	initialName = "",
	initialDescription = "",
	onSave,
	onCancel,
	saveLabel,
}: SetupFormProps) {
	const [name, setName] = useState(initialName);
	const [description, setDescription] = useState(initialDescription);
	const [saving, setSaving] = useState(false);
	const [err, setErr] = useState<string | null>(null);

	async function handleSave() {
		if (!name.trim()) {
			setErr("Name is required.");
			return;
		}
		setSaving(true);
		setErr(null);
		try {
			await onSave(name.trim(), description.trim());
		} catch {
			setErr("Failed to save. Please try again.");
			setSaving(false);
		}
	}

	const fieldStyle: React.CSSProperties = {
		background: "var(--color-surface-base)",
		border: "1px solid var(--color-border)",
		borderRadius: "var(--radius-control)",
		color: "var(--color-text)",
		fontSize: 12,
		padding: "5px 8px",
		width: "100%",
		outline: "none",
	};

	const labelStyle: React.CSSProperties = {
		display: "block",
		fontSize: 11,
		color: "var(--color-text-muted)",
		marginBottom: 4,
		fontWeight: 500,
		letterSpacing: "0.03em",
		textTransform: "uppercase",
	};

	return (
		<div
			style={{
				padding: "12px 16px",
				borderBottom: "1px solid var(--color-border)",
				background: "var(--color-surface-base)",
			}}
		>
			<div className="flex flex-col gap-3">
				<div>
					<label style={labelStyle}>Name</label>
					<input
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="e.g. ORB, VWAP Fade"
						style={fieldStyle}
						onKeyDown={(e) => {
							if (e.key === "Enter") handleSave();
							if (e.key === "Escape") onCancel();
						}}
					/>
				</div>
				<div>
					<label style={labelStyle}>Description</label>
					<input
						type="text"
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						placeholder="Optional notes about this setup"
						style={fieldStyle}
						onKeyDown={(e) => {
							if (e.key === "Enter") handleSave();
							if (e.key === "Escape") onCancel();
						}}
					/>
				</div>
				{err && (
					<p style={{ fontSize: 11, color: "var(--color-neg)" }}>{err}</p>
				)}
				<div className="flex items-center gap-2">
					<button
						onClick={handleSave}
						disabled={saving}
						style={{
							display: "flex",
							alignItems: "center",
							gap: 5,
							padding: "5px 10px",
							background: "var(--color-accent)",
							color: "#fff",
							border: "none",
							borderRadius: "var(--radius-control)",
							fontSize: 12,
							cursor: saving ? "not-allowed" : "pointer",
							opacity: saving ? 0.6 : 1,
							fontFamily: "inherit",
						}}
					>
						<Check size={12} strokeWidth={1.5} />
						{saveLabel}
					</button>
					<button
						onClick={onCancel}
						style={{
							display: "flex",
							alignItems: "center",
							gap: 5,
							padding: "5px 10px",
							background: "transparent",
							color: "var(--color-text-muted)",
							border: "1px solid var(--color-border)",
							borderRadius: "var(--radius-control)",
							fontSize: 12,
							cursor: "pointer",
							fontFamily: "inherit",
						}}
					>
						<X size={12} strokeWidth={1.5} />
						Cancel
					</button>
				</div>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Setup card row
// ---------------------------------------------------------------------------

interface SetupCardProps {
	setup: Setup;
	group: BreakGroup | undefined;
	currency: string;
	onEdit: (setup: Setup) => void;
	onDelete: (setup: Setup) => void;
	onConvert: (setup: Setup) => void;
	editingId: string | null;
	onSaveEdit: (name: string, description: string) => Promise<void>;
	onCancelEdit: () => void;
}

function SetupCard({
	setup,
	group,
	currency,
	onEdit,
	onDelete,
	onConvert,
	editingId,
	onSaveEdit,
	onCancelEdit,
}: SetupCardProps) {
	const [confirmDelete, setConfirmDelete] = useState(false);

	const sum = group?.summary;
	const trades = sum?.total_trades ?? 0;
	const winRate = sum?.win_rate ?? 0;
	const netPnl = sum?.net_pnl ?? 0;
	const pf = sum?.profit_factor ?? 0;
	const exp = sum?.expectancy ?? 0;
	const hasData = trades > 0;

	const isEditing = editingId === setup.id;
	const thesis = setup.thesis || setup.description;
	const checklist = setup.checklist ?? [];

	return (
		<div
			style={{
				borderBottom: "1px solid var(--color-border)",
			}}
		>
			{/* Card header row */}
			<div
				className="flex items-start justify-between"
				style={{ padding: "10px 16px 0" }}
			>
				<div className="flex flex-col gap-0.5">
					<span
						style={{
							fontSize: 13,
							fontWeight: 600,
							color: "var(--color-text)",
							
						}}
					>
						{setup.name}
						{setup.symbol ? (
							<span
								style={{
									marginLeft: 8,
									fontSize: 11,
									fontWeight: 500,
									color: "var(--color-text-muted)",
								}}
							>
								{setup.symbol}
								{setup.direction ? ` · ${setup.direction.toUpperCase()}` : ""}
							</span>
						) : null}
					</span>
					{thesis && (
						<span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
							{thesis}
						</span>
					)}
					{checklist.length > 0 && (
						<span
							style={{
								fontSize: 10,
								color: "var(--color-text-dim)",
								
							}}
						>
							{checklist.length} checklist item
							{checklist.length === 1 ? "" : "s"}
						</span>
					)}
				</div>
				<div className="flex items-center gap-1 shrink-0 ml-3">
					<button
						type="button"
						aria-label={`Convert ${setup.name} to trade`}
						onClick={() => onConvert(setup)}
						style={{
							background: "transparent",
							border: "1px solid var(--color-border)",
							color: "var(--color-text-muted)",
							cursor: "pointer",
							padding: "2px 8px",
							borderRadius: "var(--radius-control)",
							fontSize: 11,
							fontFamily: "inherit",
						}}
					>
						Trade
					</button>
					<button
						aria-label={`Edit ${setup.name}`}
						onClick={() => onEdit(setup)}
						style={{
							background: "none",
							border: "none",
							color: "var(--color-text-muted)",
							cursor: "pointer",
							padding: 4,
							borderRadius: "var(--radius-control)",
						}}
						onMouseEnter={(e) => {
							(e.currentTarget as HTMLElement).style.color =
								"var(--color-accent)";
						}}
						onMouseLeave={(e) => {
							(e.currentTarget as HTMLElement).style.color =
								"var(--color-text-muted)";
						}}
					>
						<Pencil size={13} strokeWidth={1.5} />
					</button>
					{confirmDelete ? (
						<span className="flex items-center gap-1">
							<button
								aria-label="Confirm delete"
								onClick={() => {
									setConfirmDelete(false);
									onDelete(setup);
								}}
								style={{
									background: "none",
									border: "none",
									color: "var(--color-neg)",
									cursor: "pointer",
									fontSize: 11,
									padding: "2px 4px",
									borderRadius: "var(--radius-control)",
								}}
							>
								Delete
							</button>
							<button
								aria-label="Cancel delete"
								onClick={() => setConfirmDelete(false)}
								style={{
									background: "none",
									border: "none",
									color: "var(--color-text-muted)",
									cursor: "pointer",
									fontSize: 11,
									padding: "2px 4px",
									borderRadius: "var(--radius-control)",
								}}
							>
								Cancel
							</button>
						</span>
					) : (
						<button
							aria-label={`Delete ${setup.name}`}
							onClick={() => setConfirmDelete(true)}
							style={{
								background: "none",
								border: "none",
								color: "var(--color-text-muted)",
								cursor: "pointer",
								padding: 4,
								borderRadius: "var(--radius-control)",
							}}
							onMouseEnter={(e) => {
								(e.currentTarget as HTMLElement).style.color =
									"var(--color-neg)";
							}}
							onMouseLeave={(e) => {
								(e.currentTarget as HTMLElement).style.color =
									"var(--color-text-muted)";
							}}
						>
							<Trash2 size={13} strokeWidth={1.5} />
						</button>
					)}
				</div>
			</div>

			{/* Stats row */}
			<div
				className="flex items-center gap-4 flex-wrap"
				style={{ padding: "6px 16px 10px" }}
			>
				<Stat label="Trades" value={hasData ? String(trades) : "-"} />
				<Stat
					label="Win Rate"
					value={hasData ? fmtPct(winRate, intlLocale()) : "-"}
				/>
				<Stat
					label="Net P&L"
					value={hasData ? fmtSignedMoney(netPnl, currency, intlLocale()) : "-"}
					valueClass={hasData ? pnlColor(netPnl) : ""}
				/>
				<Stat
					label="Profit Factor"
					value={hasData && pf > 0 ? pf.toFixed(2) : "-"}
				/>
				<Stat
					label="Expectancy"
					value={hasData ? fmtSignedMoney(exp, currency, intlLocale()) : "-"}
					valueClass={hasData ? pnlColor(exp) : ""}
				/>
			</div>

			{/* Inline edit form */}
			{isEditing && (
				<SetupForm
					initialName={setup.name}
					initialDescription={thesis}
					onSave={onSaveEdit}
					onCancel={onCancelEdit}
					saveLabel="Save"
				/>
			)}
		</div>
	);
}

function Stat({
	label,
	value,
	valueClass = "",
}: {
	label: string;
	value: string;
	valueClass?: string;
}) {
	return (
		<div className="flex flex-col gap-0.5">
			<span
				style={{
					fontSize: 10,
					color: "var(--color-text-muted)",
					textTransform: "uppercase",
					letterSpacing: "0.04em",
					fontWeight: 500,
				}}
			>
				{label}
			</span>
			<span
				className={`tabular-nums ${valueClass}`}
				style={{
					fontSize: 12,
					
					color: valueClass ? undefined : "var(--color-text)",
					fontWeight: 600,
				}}
			>
				{value}
			</span>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function PlaybookView({
	setups,
	setupsLoading,
	setupsError,
	breakdown,
	currency,
	onCreate,
	onUpdate,
	onDelete,
}: PlaybookViewProps) {
	const [showCreateForm, setShowCreateForm] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const openTradeFromSetup = useUI((s) => s.openTradeFromSetup);

	function convertSetup(setup: Setup) {
		openTradeFromSetup({
			setupId: setup.id,
			symbol: setup.symbol || undefined,
			side:
				setup.direction === "short"
					? "short"
					: setup.direction === "long"
						? "long"
						: undefined,
			target: setup.target_price != null ? String(setup.target_price) : undefined,
			stop: setup.stop_price != null ? String(setup.stop_price) : undefined,
			notes: setup.thesis || setup.description || undefined,
		});
	}

	const panelRight = (
		<button
			onClick={() => {
				setShowCreateForm((v) => !v);
				setEditingId(null);
			}}
			style={{
				display: "flex",
				alignItems: "center",
				gap: 5,
				padding: "4px 10px",
				background: showCreateForm
					? "var(--color-accent-subtle)"
					: "transparent",
				color: showCreateForm
					? "var(--color-accent)"
					: "var(--color-text-muted)",
				border: "1px solid var(--color-border)",
				borderRadius: "var(--radius-control)",
				fontSize: 12,
				cursor: "pointer",
				fontFamily: "inherit",
			}}
		>
			<Plus size={13} strokeWidth={1.5} />
			New setup
		</button>
	);

	const renderContent = () => {
		if (setupsLoading) {
			return (
				<div className="flex flex-col gap-2 p-4">
					{Array.from({ length: 3 }).map((_, i) => (
						<Skeleton key={i} height="64px" />
					))}
				</div>
			);
		}

		if (setupsError) {
			return (
				<p className="p-4 text-xs" style={{ color: "var(--color-neg)" }}>
					Failed to load setups.
				</p>
			);
		}

		return (
			<>
				{/* Create form at top */}
				{showCreateForm && (
					<SetupForm
						onSave={async (name, description) => {
							await onCreate({
								name,
								description,
								thesis: description,
								checklist: [],
							});
							setShowCreateForm(false);
						}}
						onCancel={() => setShowCreateForm(false)}
						saveLabel="Create"
					/>
				)}

				{setups.length === 0 && !showCreateForm ? (
					<EmptyState
						title="No setups yet"
						hint="Create a setup to start tracking your playbook."
						icon={<BookOpen size={32} strokeWidth={1.5} />}
					/>
				) : (
					<div>
						{setups.map((setup) => (
							<SetupCard
								key={setup.id}
								setup={setup}
								group={getGroupForSetup(breakdown, setup.name)}
								currency={currency}
								editingId={editingId}
								onEdit={(s) => {
									setEditingId(s.id === editingId ? null : s.id);
									setShowCreateForm(false);
								}}
								onSaveEdit={async (name, description) => {
									await onUpdate(setup.id, {
										name,
										description,
										thesis: description,
										symbol: setup.symbol,
										direction: setup.direction,
										target_price: setup.target_price,
										stop_price: setup.stop_price,
										checklist: setup.checklist ?? [],
									});
									setEditingId(null);
								}}
								onCancelEdit={() => setEditingId(null)}
								onConvert={convertSetup}
								onDelete={async (s) => {
									await onDelete(s.id);
								}}
							/>
						))}
					</div>
				)}
			</>
		);
	};

	return (
		<Page>
			<Card title="Playbook" action={panelRight}>
				{renderContent()}
			</Card>
		</Page>
	);
}
