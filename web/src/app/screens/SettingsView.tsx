import {
	BookOpen,
	Check,
	Globe,
	Plus,
	Settings,
	Shield,
	Tag,
	Trash2,
	Wallet,
	X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { EmptyState } from "../../components/EmptyState";
import { Panel } from "../../components/Panel";
import { SignalSelect } from "../../components/SignalSelect";
import { Skeleton } from "../../components/Skeleton";
import type { RiskRules } from "../../lib/api/settings";
import type {
	Account,
	CashTransaction,
	Setup,
	Tag as TagType,
} from "../../lib/api/types";

// ---------------------------------------------------------------------------
// Shared style helpers
// ---------------------------------------------------------------------------

const fieldStyle: React.CSSProperties = {
	background: "var(--color-surface-base)",
	border: "1px solid var(--color-border)",
	borderRadius: "var(--radius-control)",
	color: "var(--color-text)",
	fontSize: 12,
	padding: "5px 8px",
	width: "100%",
	fontFamily: "var(--font-mono)",
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

const btnPrimary: React.CSSProperties = {
	display: "flex",
	alignItems: "center",
	gap: 5,
	padding: "5px 10px",
	background: "var(--color-accent)",
	color: "#fff",
	border: "none",
	borderRadius: "var(--radius-control)",
	fontSize: 12,
	cursor: "pointer",
	fontFamily: "inherit",
};

const btnGhost: React.CSSProperties = {
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
};

const rowStyle: React.CSSProperties = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	padding: "8px 16px",
	borderBottom: "1px solid var(--color-border)",
	fontSize: 12,
};

// ---------------------------------------------------------------------------
// DeleteButton - inline confirm pattern
// ---------------------------------------------------------------------------

function DeleteButton({
	label,
	onDelete,
}: { label: string; onDelete: () => void }) {
	const [confirm, setConfirm] = useState(false);

	if (confirm) {
		return (
			<span style={{ display: "flex", alignItems: "center", gap: 6 }}>
				<button
					onClick={() => {
						setConfirm(false);
						onDelete();
					}}
					style={{
						...btnGhost,
						color: "var(--color-neg)",
						borderColor: "var(--color-neg)",
						padding: "3px 8px",
					}}
				>
					Delete
				</button>
				<button
					onClick={() => setConfirm(false)}
					style={{ ...btnGhost, padding: "3px 8px" }}
				>
					Cancel
				</button>
			</span>
		);
	}

	return (
		<button
			aria-label={`Delete ${label}`}
			onClick={() => setConfirm(true)}
			style={{
				background: "none",
				border: "none",
				color: "var(--color-text-muted)",
				cursor: "pointer",
				padding: 4,
			}}
			onMouseEnter={(e) => {
				(e.currentTarget as HTMLElement).style.color = "var(--color-neg)";
			}}
			onMouseLeave={(e) => {
				(e.currentTarget as HTMLElement).style.color =
					"var(--color-text-muted)";
			}}
		>
			<Trash2 size={13} strokeWidth={1.5} />
		</button>
	);
}

// ---------------------------------------------------------------------------
// Accounts section
// ---------------------------------------------------------------------------

interface AccountsSectionProps {
	accounts: Account[];
	loading: boolean;
	error: boolean;
	onCreate: (body: {
		name: string;
		broker: string;
		account_type: string;
		base_currency: string;
		starting_balance: number;
	}) => Promise<void>;
	onDelete: (id: string) => Promise<void>;
}

function AccountsSection({
	accounts,
	loading,
	error,
	onCreate,
	onDelete,
}: AccountsSectionProps) {
	const [showForm, setShowForm] = useState(false);
	const [name, setName] = useState("");
	const [broker, setBroker] = useState("");
	const [accountType, setAccountType] = useState("cash");
	const [baseCurrency, setBaseCurrency] = useState("USD");
	const [startingBalance, setStartingBalance] = useState("");
	const [saving, setSaving] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

	async function handleCreate() {
		if (!name.trim()) {
			setFormError("Name is required.");
			return;
		}
		const balance = Number.parseFloat(startingBalance);
		if (Number.isNaN(balance)) {
			setFormError("Starting balance must be a number.");
			return;
		}
		setSaving(true);
		setFormError(null);
		try {
			await onCreate({
				name: name.trim(),
				broker: broker.trim(),
				account_type: accountType,
				base_currency: baseCurrency.trim() || "USD",
				starting_balance: balance,
			});
			setName("");
			setBroker("");
			setAccountType("cash");
			setBaseCurrency("USD");
			setStartingBalance("");
			setShowForm(false);
		} catch {
			setFormError("Failed to create account.");
		} finally {
			setSaving(false);
		}
	}

	const addBtn = (
		<button
			onClick={() => setShowForm((v) => !v)}
			style={{
				...btnGhost,
				color: showForm ? "var(--color-accent)" : "var(--color-text-muted)",
				background: showForm ? "var(--color-accent-subtle)" : "transparent",
			}}
		>
			<Plus size={13} strokeWidth={1.5} />
			Add account
		</button>
	);

	return (
		<Panel title="Accounts" right={addBtn}>
			{showForm && (
				<div
					style={{
						padding: "12px 16px",
						borderBottom: "1px solid var(--color-border)",
						background: "var(--color-surface-base)",
					}}
				>
					<div className="flex flex-col gap-3">
						<div className="grid grid-cols-2 gap-3">
							<div>
								<label style={labelStyle}>Name</label>
								<input
									type="text"
									value={name}
									onChange={(e) => setName(e.target.value)}
									style={fieldStyle}
									placeholder="e.g. Main Account"
								/>
							</div>
							<div>
								<label style={labelStyle}>Broker</label>
								<input
									type="text"
									value={broker}
									onChange={(e) => setBroker(e.target.value)}
									style={fieldStyle}
									placeholder="e.g. IBKR"
								/>
							</div>
						</div>
						<div className="grid grid-cols-3 gap-3">
							<div>
								<label style={labelStyle}>Account Type</label>
								<SignalSelect
									value={accountType}
									onValueChange={setAccountType}
									ariaLabel="Account type"
									options={[
										{ value: "cash", label: "Cash" },
										{ value: "margin", label: "Margin" },
										{ value: "prop", label: "Prop" },
									]}
									triggerClassName="h-8 font-mono text-[12px]"
								/>
							</div>
							<div>
								<label style={labelStyle}>Base Currency</label>
								<input
									type="text"
									value={baseCurrency}
									onChange={(e) => setBaseCurrency(e.target.value)}
									style={fieldStyle}
									placeholder="USD"
								/>
							</div>
							<div>
								<label style={labelStyle}>Starting Balance</label>
								<input
									type="number"
									value={startingBalance}
									onChange={(e) => setStartingBalance(e.target.value)}
									style={fieldStyle}
									placeholder="0.00"
								/>
							</div>
						</div>
						{formError && (
							<p style={{ fontSize: 11, color: "var(--color-neg)" }}>
								{formError}
							</p>
						)}
						<div className="flex items-center gap-2">
							<button
								onClick={handleCreate}
								disabled={saving}
								style={{
									...btnPrimary,
									opacity: saving ? 0.6 : 1,
									cursor: saving ? "not-allowed" : "pointer",
								}}
							>
								<Check size={12} strokeWidth={1.5} />
								Create
							</button>
							<button
								onClick={() => {
									setShowForm(false);
									setFormError(null);
								}}
								style={btnGhost}
							>
								<X size={12} strokeWidth={1.5} />
								Cancel
							</button>
						</div>
					</div>
				</div>
			)}

			{loading ? (
				<div className="flex flex-col gap-2 p-4">
					{Array.from({ length: 3 }).map((_, i) => (
						<Skeleton key={i} height="40px" />
					))}
				</div>
			) : error ? (
				<p className="p-4 text-xs" style={{ color: "var(--color-neg)" }}>
					Failed to load accounts.
				</p>
			) : accounts.length === 0 ? (
				<EmptyState
					title="No accounts yet"
					hint="Add an account to get started."
					icon={<Settings size={28} strokeWidth={1.5} />}
				/>
			) : (
				<div>
					{accounts.map((acc) => (
						<div key={acc.id} style={rowStyle}>
							<div className="flex flex-col gap-0.5">
								<span
									style={{
										color: "var(--color-text)",
										fontWeight: 600,
										fontFamily: "var(--font-mono)",
									}}
								>
									{acc.name}
								</span>
								<span
									style={{ color: "var(--color-text-muted)", fontSize: 11 }}
								>
									{acc.broker || "-"} &middot; {acc.account_type} &middot;{" "}
									{acc.base_currency} &middot;{" "}
									<span className="tabular-nums">
										{acc.starting_balance.toLocaleString("en-US", {
											style: "currency",
											currency: acc.base_currency,
										})}
									</span>
								</span>
							</div>
							<DeleteButton
								label={acc.name}
								onDelete={() => onDelete(acc.id)}
							/>
						</div>
					))}
				</div>
			)}
		</Panel>
	);
}

// ---------------------------------------------------------------------------
// Cash transactions section
// ---------------------------------------------------------------------------

interface CashSectionProps {
	accounts: Account[];
	transactions: CashTransaction[];
	loading: boolean;
	error: boolean;
	onCreate: (body: {
		account_id: string;
		type: string;
		amount: number;
		currency: string;
		occurred_at: string;
		note?: string;
	}) => Promise<void>;
	onDelete: (id: string) => Promise<void>;
}

function CashSection({
	accounts,
	transactions,
	loading,
	error,
	onCreate,
	onDelete,
}: CashSectionProps) {
	const [showForm, setShowForm] = useState(false);
	const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
	const [type, setType] = useState("deposit");
	const [amount, setAmount] = useState("");
	const [occurredAt, setOccurredAt] = useState(
		new Date().toISOString().slice(0, 10),
	);
	const [note, setNote] = useState("");
	const [saving, setSaving] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

	async function handleCreate() {
		if (!accountId) {
			setFormError("Account is required.");
			return;
		}
		const amt = Number.parseFloat(amount);
		if (Number.isNaN(amt) || amt <= 0) {
			setFormError("Amount must be a positive number.");
			return;
		}
		const acct = accounts.find((a) => a.id === accountId);
		setSaving(true);
		setFormError(null);
		try {
			await onCreate({
				account_id: accountId,
				type,
				amount: amt,
				currency: acct?.base_currency ?? "USD",
				occurred_at: `${occurredAt}T00:00:00Z`,
				note: note.trim() || undefined,
			});
			setAmount("");
			setNote("");
			setShowForm(false);
		} catch {
			setFormError("Failed to create transaction.");
		} finally {
			setSaving(false);
		}
	}

	const addBtn = (
		<button
			onClick={() => setShowForm((v) => !v)}
			style={{
				...btnGhost,
				color: showForm ? "var(--color-accent)" : "var(--color-text-muted)",
				background: showForm ? "var(--color-accent-subtle)" : "transparent",
			}}
		>
			<Plus size={13} strokeWidth={1.5} />
			Add transaction
		</button>
	);

	return (
		<Panel title="Cash Transactions" right={addBtn}>
			{showForm && (
				<div
					style={{
						padding: "12px 16px",
						borderBottom: "1px solid var(--color-border)",
						background: "var(--color-surface-base)",
					}}
				>
					<div className="flex flex-col gap-3">
						<div className="grid grid-cols-2 gap-3">
							<div>
								<label style={labelStyle}>Account</label>
								<SignalSelect
									value={accountId}
									onValueChange={setAccountId}
									ariaLabel="Cash account"
									options={accounts.map((a) => ({
										value: a.id,
										label: a.name,
									}))}
									triggerClassName="h-8 font-mono text-[12px]"
								/>
							</div>
							<div>
								<label style={labelStyle}>Type</label>
								<SignalSelect
									value={type}
									onValueChange={setType}
									ariaLabel="Cash type"
									options={[
										{ value: "deposit", label: "Deposit" },
										{ value: "withdrawal", label: "Withdrawal" },
										{ value: "fee", label: "Fee" },
										{ value: "dividend", label: "Dividend" },
										{ value: "interest", label: "Interest" },
										{ value: "adjustment", label: "Adjustment" },
									]}
									triggerClassName="h-8 font-mono text-[12px]"
								/>
							</div>
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div>
								<label style={labelStyle}>Amount</label>
								<input
									type="number"
									value={amount}
									onChange={(e) => setAmount(e.target.value)}
									style={fieldStyle}
									placeholder="0.00"
								/>
							</div>
							<div>
								<label style={labelStyle}>Date</label>
								<input
									type="date"
									value={occurredAt}
									onChange={(e) => setOccurredAt(e.target.value)}
									style={fieldStyle}
								/>
							</div>
						</div>
						<div>
							<label style={labelStyle}>Note</label>
							<input
								type="text"
								value={note}
								onChange={(e) => setNote(e.target.value)}
								style={fieldStyle}
								placeholder="Optional note"
							/>
						</div>
						{formError && (
							<p style={{ fontSize: 11, color: "var(--color-neg)" }}>
								{formError}
							</p>
						)}
						<div className="flex items-center gap-2">
							<button
								onClick={handleCreate}
								disabled={saving}
								style={{
									...btnPrimary,
									opacity: saving ? 0.6 : 1,
									cursor: saving ? "not-allowed" : "pointer",
								}}
							>
								<Check size={12} strokeWidth={1.5} />
								Add
							</button>
							<button
								onClick={() => {
									setShowForm(false);
									setFormError(null);
								}}
								style={btnGhost}
							>
								<X size={12} strokeWidth={1.5} />
								Cancel
							</button>
						</div>
					</div>
				</div>
			)}

			{loading ? (
				<div className="flex flex-col gap-2 p-4">
					{Array.from({ length: 3 }).map((_, i) => (
						<Skeleton key={i} height="40px" />
					))}
				</div>
			) : error ? (
				<p className="p-4 text-xs" style={{ color: "var(--color-neg)" }}>
					Failed to load transactions.
				</p>
			) : transactions.length === 0 ? (
				<EmptyState
					title="No transactions yet"
					hint="Add a cash transaction to track your account balance changes."
					icon={<Wallet size={28} strokeWidth={1.5} />}
				/>
			) : (
				<div>
					{transactions.map((tx) => (
						<div key={tx.id} style={rowStyle}>
							<div className="flex flex-col gap-0.5">
								<span
									style={{
										color: "var(--color-text)",
										fontWeight: 600,
										textTransform: "capitalize",
									}}
								>
									{tx.type}
								</span>
								<span
									style={{ color: "var(--color-text-muted)", fontSize: 11 }}
								>
									<span className="tabular-nums">
										{tx.amount.toLocaleString("en-US", {
											style: "currency",
											currency: tx.currency,
										})}
									</span>{" "}
									&middot; {tx.occurred_at.slice(0, 10)}
									{tx.note ? <> &middot; {tx.note}</> : null}
								</span>
							</div>
							<DeleteButton
								label={`${tx.type} ${tx.amount}`}
								onDelete={() => onDelete(tx.id)}
							/>
						</div>
					))}
				</div>
			)}
		</Panel>
	);
}

// ---------------------------------------------------------------------------
// Tags section
// ---------------------------------------------------------------------------

interface TagsSectionProps {
	tags: TagType[];
	loading: boolean;
	error: boolean;
	onCreate: (body: {
		name: string;
		color?: string;
		kind?: string;
	}) => Promise<void>;
	onDelete: (id: string) => Promise<void>;
}

function TagsSection({
	tags,
	loading,
	error,
	onCreate,
	onDelete,
}: TagsSectionProps) {
	const [showForm, setShowForm] = useState(false);
	const [name, setName] = useState("");
	const [color, setColor] = useState("#6366f1");
	const [kind, setKind] = useState("custom");
	const [saving, setSaving] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

	async function handleCreate() {
		if (!name.trim()) {
			setFormError("Name is required.");
			return;
		}
		setSaving(true);
		setFormError(null);
		try {
			await onCreate({ name: name.trim(), color, kind });
			setName("");
			setColor("#6366f1");
			setKind("custom");
			setShowForm(false);
		} catch {
			setFormError("Failed to create tag.");
		} finally {
			setSaving(false);
		}
	}

	const addBtn = (
		<button
			onClick={() => setShowForm((v) => !v)}
			style={{
				...btnGhost,
				color: showForm ? "var(--color-accent)" : "var(--color-text-muted)",
				background: showForm ? "var(--color-accent-subtle)" : "transparent",
			}}
		>
			<Plus size={13} strokeWidth={1.5} />
			Add tag
		</button>
	);

	return (
		<Panel title="Tags" right={addBtn}>
			{showForm && (
				<div
					style={{
						padding: "12px 16px",
						borderBottom: "1px solid var(--color-border)",
						background: "var(--color-surface-base)",
					}}
				>
					<div className="flex flex-col gap-3">
						<div className="grid grid-cols-3 gap-3">
							<div>
								<label style={labelStyle}>Name</label>
								<input
									type="text"
									value={name}
									onChange={(e) => setName(e.target.value)}
									style={fieldStyle}
									placeholder="e.g. FOMO"
								/>
							</div>
							<div>
								<label style={labelStyle}>Color</label>
								<input
									type="color"
									value={color}
									onChange={(e) => setColor(e.target.value)}
									style={{ ...fieldStyle, padding: "2px 4px", height: 30 }}
								/>
							</div>
							<div>
								<label style={labelStyle}>Kind</label>
								<SignalSelect
									value={kind}
									onValueChange={setKind}
									ariaLabel="Tag kind"
									options={[
										{ value: "custom", label: "Custom" },
										{ value: "mistake", label: "Mistake" },
									]}
									triggerClassName="h-8 font-mono text-[12px]"
								/>
							</div>
						</div>
						{formError && (
							<p style={{ fontSize: 11, color: "var(--color-neg)" }}>
								{formError}
							</p>
						)}
						<div className="flex items-center gap-2">
							<button
								onClick={handleCreate}
								disabled={saving}
								style={{
									...btnPrimary,
									opacity: saving ? 0.6 : 1,
									cursor: saving ? "not-allowed" : "pointer",
								}}
							>
								<Check size={12} strokeWidth={1.5} />
								Create
							</button>
							<button
								onClick={() => {
									setShowForm(false);
									setFormError(null);
								}}
								style={btnGhost}
							>
								<X size={12} strokeWidth={1.5} />
								Cancel
							</button>
						</div>
					</div>
				</div>
			)}

			{loading ? (
				<div className="flex flex-col gap-2 p-4">
					{Array.from({ length: 3 }).map((_, i) => (
						<Skeleton key={i} height="36px" />
					))}
				</div>
			) : error ? (
				<p className="p-4 text-xs" style={{ color: "var(--color-neg)" }}>
					Failed to load tags.
				</p>
			) : tags.length === 0 ? (
				<EmptyState
					title="No tags yet"
					hint="Create tags to annotate your trades."
					icon={<Tag size={28} strokeWidth={1.5} />}
				/>
			) : (
				<div>
					{tags.map((tag) => (
						<div key={tag.id} style={rowStyle}>
							<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
								<span
									style={{
										width: 12,
										height: 12,
										borderRadius: "50%",
										background: tag.color || "#6366f1",
										flexShrink: 0,
									}}
								/>
								<span style={{ color: "var(--color-text)", fontWeight: 600 }}>
									{tag.name}
								</span>
								<span
									style={{
										color: "var(--color-text-muted)",
										fontSize: 11,
										textTransform: "capitalize",
									}}
								>
									{tag.kind}
								</span>
							</div>
							<DeleteButton
								label={tag.name}
								onDelete={() => onDelete(tag.id)}
							/>
						</div>
					))}
				</div>
			)}
		</Panel>
	);
}

// ---------------------------------------------------------------------------
// Setups section
// ---------------------------------------------------------------------------

interface SetupsSectionProps {
	setups: Setup[];
	loading: boolean;
	error: boolean;
	onCreate: (name: string, description: string) => Promise<void>;
	onDelete: (id: string) => Promise<void>;
}

function SetupsSection({
	setups,
	loading,
	error,
	onCreate,
	onDelete,
}: SetupsSectionProps) {
	const [showForm, setShowForm] = useState(false);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [saving, setSaving] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

	async function handleCreate() {
		if (!name.trim()) {
			setFormError("Name is required.");
			return;
		}
		setSaving(true);
		setFormError(null);
		try {
			await onCreate(name.trim(), description.trim());
			setName("");
			setDescription("");
			setShowForm(false);
		} catch {
			setFormError("Failed to create setup.");
		} finally {
			setSaving(false);
		}
	}

	const addBtn = (
		<button
			onClick={() => setShowForm((v) => !v)}
			style={{
				...btnGhost,
				color: showForm ? "var(--color-accent)" : "var(--color-text-muted)",
				background: showForm ? "var(--color-accent-subtle)" : "transparent",
			}}
		>
			<Plus size={13} strokeWidth={1.5} />
			Add setup
		</button>
	);

	return (
		<Panel title="Setups" right={addBtn}>
			{showForm && (
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
								style={fieldStyle}
								placeholder="e.g. ORB, VWAP Fade"
							/>
						</div>
						<div>
							<label style={labelStyle}>Description</label>
							<input
								type="text"
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								style={fieldStyle}
								placeholder="Optional notes"
							/>
						</div>
						{formError && (
							<p style={{ fontSize: 11, color: "var(--color-neg)" }}>
								{formError}
							</p>
						)}
						<div className="flex items-center gap-2">
							<button
								onClick={handleCreate}
								disabled={saving}
								style={{
									...btnPrimary,
									opacity: saving ? 0.6 : 1,
									cursor: saving ? "not-allowed" : "pointer",
								}}
							>
								<Check size={12} strokeWidth={1.5} />
								Create
							</button>
							<button
								onClick={() => {
									setShowForm(false);
									setFormError(null);
								}}
								style={btnGhost}
							>
								<X size={12} strokeWidth={1.5} />
								Cancel
							</button>
						</div>
					</div>
				</div>
			)}

			{loading ? (
				<div className="flex flex-col gap-2 p-4">
					{Array.from({ length: 3 }).map((_, i) => (
						<Skeleton key={i} height="36px" />
					))}
				</div>
			) : error ? (
				<p className="p-4 text-xs" style={{ color: "var(--color-neg)" }}>
					Failed to load setups.
				</p>
			) : setups.length === 0 ? (
				<EmptyState
					title="No setups yet"
					hint="Create a setup to track your playbook strategies."
					icon={<BookOpen size={28} strokeWidth={1.5} />}
				/>
			) : (
				<div>
					{setups.map((setup) => (
						<div key={setup.id} style={rowStyle}>
							<div className="flex flex-col gap-0.5">
								<span
									style={{
										color: "var(--color-text)",
										fontWeight: 600,
										fontFamily: "var(--font-mono)",
									}}
								>
									{setup.name}
								</span>
								{setup.description && (
									<span
										style={{ color: "var(--color-text-muted)", fontSize: 11 }}
									>
										{setup.description}
									</span>
								)}
							</div>
							<DeleteButton
								label={setup.name}
								onDelete={() => onDelete(setup.id)}
							/>
						</div>
					))}
				</div>
			)}
		</Panel>
	);
}

// ---------------------------------------------------------------------------
// Language section
// ---------------------------------------------------------------------------

interface LanguageSectionProps {
	currentLocale: string;
	onLocaleChange: (locale: string) => void;
}

function LanguageSection({
	currentLocale,
	onLocaleChange,
}: LanguageSectionProps) {
	return (
		<Panel title="Language">
			<div style={{ padding: "12px 16px" }}>
				<div style={{ maxWidth: 240 }}>
					<label style={labelStyle}>
						<Globe
							size={11}
							strokeWidth={1.5}
							style={{ display: "inline", marginRight: 4 }}
						/>
						Interface Language
					</label>
					<SignalSelect
						value={currentLocale}
						onValueChange={onLocaleChange}
						ariaLabel="Language selector"
						options={[{ value: "en", label: "English" }]}
						triggerClassName="h-8 font-mono text-[12px]"
					/>
					<p
						style={{
							fontSize: 11,
							color: "var(--color-text-muted)",
							marginTop: 6,
						}}
					>
						Additional languages will be available in a future update.
					</p>
				</div>
			</div>
		</Panel>
	);
}

// ---------------------------------------------------------------------------
// Risk rules section
// ---------------------------------------------------------------------------

function numOrEmpty(v: number | null | undefined): string {
	return v == null ? "" : String(v);
}

function parseOptionalNum(v: string): number | null {
	const t = v.trim();
	if (!t) return null;
	const n = Number(t);
	return Number.isFinite(n) ? n : null;
}

interface RiskRulesSectionProps {
	rules?: RiskRules;
	loading: boolean;
	error: boolean;
	saving: boolean;
	onSave: (body: RiskRules) => Promise<void>;
}

function RiskRulesSection({
	rules,
	loading,
	error,
	saving,
	onSave,
}: RiskRulesSectionProps) {
	const [maxRisk, setMaxRisk] = useState("");
	const [maxDaily, setMaxDaily] = useState("");
	const [maxOpen, setMaxOpen] = useState("");
	const [riskPct, setRiskPct] = useState("");
	const [formError, setFormError] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);

	useEffect(() => {
		if (!rules) return;
		setMaxRisk(numOrEmpty(rules.max_risk_per_trade));
		setMaxDaily(numOrEmpty(rules.max_daily_loss));
		setMaxOpen(numOrEmpty(rules.max_open_risk));
		setRiskPct(numOrEmpty(rules.default_account_risk_pct));
	}, [rules]);

	async function handleSave() {
		const body: RiskRules = {
			max_risk_per_trade: parseOptionalNum(maxRisk),
			max_daily_loss: parseOptionalNum(maxDaily),
			max_open_risk: parseOptionalNum(maxOpen),
			default_account_risk_pct: parseOptionalNum(riskPct),
		};
		if (
			(maxRisk.trim() && body.max_risk_per_trade == null) ||
			(maxDaily.trim() && body.max_daily_loss == null) ||
			(maxOpen.trim() && body.max_open_risk == null) ||
			(riskPct.trim() && body.default_account_risk_pct == null)
		) {
			setFormError("Enter valid numbers, or leave a field blank.");
			return;
		}
		if (
			body.default_account_risk_pct != null &&
			(body.default_account_risk_pct < 0 || body.default_account_risk_pct > 100)
		) {
			setFormError("Default risk % must be between 0 and 100.");
			return;
		}
		setFormError(null);
		setSaved(false);
		try {
			await onSave(body);
			setSaved(true);
		} catch {
			setFormError("Could not save risk rules.");
		}
	}

	return (
		<Panel title="Risk Rules">
			<div style={{ padding: "12px 16px" }}>
				<p
					style={{
						fontSize: 12,
						color: "var(--color-text-muted)",
						marginBottom: 12,
						lineHeight: 1.45,
					}}
				>
					<Shield
						size={12}
						strokeWidth={1.5}
						style={{ display: "inline", marginRight: 6, verticalAlign: -1 }}
					/>
					Used by Check compliance on New Trade. Leave blank to skip a limit.
				</p>
				{loading ? (
					<Skeleton height="120px" />
				) : error ? (
					<p style={{ fontSize: 12, color: "var(--color-neg)" }}>
						Failed to load risk rules.
					</p>
				) : (
					<div
						style={{
							display: "grid",
							gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
							gap: 12,
							maxWidth: 640,
						}}
					>
						<div>
							<label style={labelStyle}>Max risk / trade ($)</label>
							<input
								style={fieldStyle}
								inputMode="decimal"
								value={maxRisk}
								onChange={(e) => setMaxRisk(e.target.value)}
								placeholder="e.g. 100"
								aria-label="Max risk per trade"
							/>
						</div>
						<div>
							<label style={labelStyle}>Max daily loss ($)</label>
							<input
								style={fieldStyle}
								inputMode="decimal"
								value={maxDaily}
								onChange={(e) => setMaxDaily(e.target.value)}
								placeholder="e.g. 300"
								aria-label="Max daily loss"
							/>
						</div>
						<div>
							<label style={labelStyle}>Max open risk ($)</label>
							<input
								style={fieldStyle}
								inputMode="decimal"
								value={maxOpen}
								onChange={(e) => setMaxOpen(e.target.value)}
								placeholder="e.g. 500"
								aria-label="Max open risk"
							/>
						</div>
						<div>
							<label style={labelStyle}>Default account risk %</label>
							<input
								style={fieldStyle}
								inputMode="decimal"
								value={riskPct}
								onChange={(e) => setRiskPct(e.target.value)}
								placeholder="e.g. 1"
								aria-label="Default account risk percent"
							/>
						</div>
					</div>
				)}
				{formError && (
					<p
						style={{
							fontSize: 12,
							color: "var(--color-neg)",
							marginTop: 10,
						}}
					>
						{formError}
					</p>
				)}
				{!loading && !error && (
					<div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
						<button
							type="button"
							onClick={() => void handleSave()}
							disabled={saving}
							style={btnPrimary}
						>
							{saving ? "Saving…" : "Save rules"}
						</button>
						{saved && (
							<span
								style={{
									fontSize: 11,
									color: "var(--color-pos)",
									display: "inline-flex",
									alignItems: "center",
									gap: 4,
								}}
							>
								<Check size={12} strokeWidth={2} />
								Saved
							</span>
						)}
					</div>
				)}
			</div>
		</Panel>
	);
}

// ---------------------------------------------------------------------------
// Daily checklist template
// ---------------------------------------------------------------------------

interface ChecklistSectionProps {
	items: string[];
	loading: boolean;
	error: boolean;
	saving: boolean;
	onSave: (items: string[]) => Promise<void>;
}

function ChecklistSection({
	items,
	loading,
	error,
	saving,
	onSave,
}: ChecklistSectionProps) {
	const [text, setText] = useState(items.join("\n"));
	const [saved, setSaved] = useState(false);

	useEffect(() => {
		setText(items.join("\n"));
	}, [items]);

	async function handleSave() {
		const next = text
			.split("\n")
			.map((l) => l.trim())
			.filter(Boolean);
		setSaved(false);
		await onSave(next);
		setSaved(true);
	}

	return (
		<Panel title="Daily Checklist">
			<div style={{ padding: "12px 16px" }}>
				<p
					style={{
						fontSize: 12,
						color: "var(--color-text-muted)",
						marginBottom: 12,
						lineHeight: 1.45,
					}}
				>
					Pre-market / EOD checklist shown when you create a New Note. One item
					per line.
				</p>
				{loading ? (
					<Skeleton height="100px" />
				) : error ? (
					<p style={{ fontSize: 12, color: "var(--color-neg)" }}>
						Failed to load checklist template.
					</p>
				) : (
					<textarea
						aria-label="Daily checklist items"
						value={text}
						onChange={(e) => setText(e.target.value)}
						rows={5}
						placeholder={"Check VIX\nNo revenge trades\nSize within risk"}
						style={{ ...fieldStyle, resize: "vertical", minHeight: 100 }}
					/>
				)}
				{!loading && !error && (
					<div
						style={{
							marginTop: 14,
							display: "flex",
							alignItems: "center",
							gap: 10,
						}}
					>
						<button
							type="button"
							onClick={() => void handleSave()}
							disabled={saving}
							style={btnPrimary}
						>
							{saving ? "Saving…" : "Save checklist"}
						</button>
						{saved && (
							<span
								style={{
									fontSize: 11,
									color: "var(--color-pos)",
									display: "inline-flex",
									alignItems: "center",
									gap: 4,
								}}
							>
								<Check size={12} strokeWidth={2} />
								Saved
							</span>
						)}
					</div>
				)}
			</div>
		</Panel>
	);
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export interface SettingsViewProps {
	// Accounts
	accounts: Account[];
	accountsLoading: boolean;
	accountsError: boolean;
	onCreateAccount: (body: {
		name: string;
		broker: string;
		account_type: string;
		base_currency: string;
		starting_balance: number;
	}) => Promise<void>;
	onDeleteAccount: (id: string) => Promise<void>;

	// Cash
	cashTransactions: CashTransaction[];
	cashLoading: boolean;
	cashError: boolean;
	onCreateCash: (body: {
		account_id: string;
		type: string;
		amount: number;
		currency: string;
		occurred_at: string;
		note?: string;
	}) => Promise<void>;
	onDeleteCash: (id: string) => Promise<void>;

	// Tags
	tags: TagType[];
	tagsLoading: boolean;
	tagsError: boolean;
	onCreateTag: (body: {
		name: string;
		color?: string;
		kind?: string;
	}) => Promise<void>;
	onDeleteTag: (id: string) => Promise<void>;

	// Setups
	setups: Setup[];
	setupsLoading: boolean;
	setupsError: boolean;
	onCreateSetup: (name: string, description: string) => Promise<void>;
	onDeleteSetup: (id: string) => Promise<void>;

	// Risk rules
	riskRules?: RiskRules;
	riskRulesLoading: boolean;
	riskRulesError: boolean;
	riskRulesSaving: boolean;
	onSaveRiskRules: (body: RiskRules) => Promise<void>;

	// Daily checklist template
	checklistItems: string[];
	checklistLoading: boolean;
	checklistError: boolean;
	checklistSaving: boolean;
	onSaveChecklist: (items: string[]) => Promise<void>;

	// i18n
	currentLocale: string;
	onLocaleChange: (locale: string) => void;
}

export function SettingsView({
	accounts,
	accountsLoading,
	accountsError,
	onCreateAccount,
	onDeleteAccount,
	cashTransactions,
	cashLoading,
	cashError,
	onCreateCash,
	onDeleteCash,
	tags,
	tagsLoading,
	tagsError,
	onCreateTag,
	onDeleteTag,
	setups,
	setupsLoading,
	setupsError,
	onCreateSetup,
	onDeleteSetup,
	riskRules,
	riskRulesLoading,
	riskRulesError,
	riskRulesSaving,
	onSaveRiskRules,
	checklistItems,
	checklistLoading,
	checklistError,
	checklistSaving,
	onSaveChecklist,
	currentLocale,
	onLocaleChange,
}: SettingsViewProps) {
	return (
		<div className="flex flex-col gap-4">
			<AccountsSection
				accounts={accounts}
				loading={accountsLoading}
				error={accountsError}
				onCreate={onCreateAccount}
				onDelete={onDeleteAccount}
			/>
			<RiskRulesSection
				rules={riskRules}
				loading={riskRulesLoading}
				error={riskRulesError}
				saving={riskRulesSaving}
				onSave={onSaveRiskRules}
			/>
			<ChecklistSection
				items={checklistItems}
				loading={checklistLoading}
				error={checklistError}
				saving={checklistSaving}
				onSave={onSaveChecklist}
			/>
			<CashSection
				accounts={accounts}
				transactions={cashTransactions}
				loading={cashLoading}
				error={cashError}
				onCreate={onCreateCash}
				onDelete={onDeleteCash}
			/>
			<TagsSection
				tags={tags}
				loading={tagsLoading}
				error={tagsError}
				onCreate={onCreateTag}
				onDelete={onDeleteTag}
			/>
			<SetupsSection
				setups={setups}
				loading={setupsLoading}
				error={setupsError}
				onCreate={onCreateSetup}
				onDelete={onDeleteSetup}
			/>
			<LanguageSection
				currentLocale={currentLocale}
				onLocaleChange={onLocaleChange}
			/>
		</div>
	);
}
