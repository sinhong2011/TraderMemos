import { useForm } from "@tanstack/react-form";
import { BookOpen, Check, Plus, Settings, Shield, Tag, Wallet, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "../../../components/EmptyState";
import { SignalDatePicker } from "../../../components/SignalDatePicker";
import { fieldError, SignalField } from "../../../components/SignalField";
import { SignalInput, SignalTextarea } from "../../../components/SignalInput";
import { SignalSelect } from "../../../components/SignalSelect";
import { Skeleton } from "../../../components/Skeleton";
import { useToastManager } from "../../../components/Toast";
import { ApiError } from "../../../lib/api/client";
import type { RiskRules } from "../../../lib/api/settings";
import type {
	Account,
	CashTransaction,
	Setup,
	Tag as TagType,
} from "../../../lib/api/types";
import { useTrades } from "../../../lib/hooks/useTrades";
import {
	formatCashDisplay,
	signedCashAmount,
} from "../../../lib/cashAmount";
import { intlLocale, LOCALE_OPTIONS, settingsLabel } from "../../../lib/locale";
import { useAuth } from "../../../lib/auth";
import { useLocale } from "../../../i18n";
import {
	AccountRow,
	BtnGhost,
	BtnPrimary,
	BtnToolbar,
	ClearTradesButton,
	DeleteButton,
	FormError,
	SavedBadge,
	SettingsInsetForm,
	SettingsGroup,
	SettingsGroupRow,
	SettingsRow,
	SettingsSection,
} from "./settings-ui";

function primaryAccountId(accounts: Account[]): string | undefined {
	if (accounts.length === 0) return undefined;
	return [...accounts].sort((a, b) =>
		a.created_at.localeCompare(b.created_at),
	)[0]?.id;
}

function accountRecordDetail(tradeCount: number, cashCount: number): string {
	const parts: string[] = [];
	if (tradeCount > 0) {
		parts.push(`${tradeCount} trade${tradeCount === 1 ? "" : "s"}`);
	}
	if (cashCount > 0) {
		parts.push(`${cashCount} cash transaction${cashCount === 1 ? "" : "s"}`);
	}
	if (parts.length === 0) return "No trades or cash records on this account.";
	return `Permanently deletes ${parts.join(" and ")}.`;
}

function ledgerBalance(account: Account, transactions: CashTransaction[]) {
	const flows = transactions
		.filter((t) => t.account_id === account.id)
		.reduce((sum, t) => sum + t.amount, 0);
	return account.starting_balance + flows;
}

function numOrEmpty(v: number | null | undefined): string {
	return v == null ? "" : String(v);
}

function parseOptionalNum(v: string): number | null {
	const t = v.trim();
	if (!t) return null;
	const n = Number(t);
	return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// Accounts & funding
// ---------------------------------------------------------------------------

export interface AccountsTabProps {
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
	onClearAccountTrades: (id: string) => Promise<void>;
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
}

export function AccountsTab({
	accounts,
	accountsLoading,
	accountsError,
	onCreateAccount,
	onDeleteAccount,
	onClearAccountTrades,
	cashTransactions,
	cashLoading,
	cashError,
	onCreateCash,
	onDeleteCash,
}: AccountsTabProps) {
	const toast = useToastManager();
	const [showAccountForm, setShowAccountForm] = useState(false);
	const [showCashForm, setShowCashForm] = useState(false);
	const [filterAccountId, setFilterAccountId] = useState<string | null>(null);
	const [accountSaving, setAccountSaving] = useState(false);
	const [accountFormError, setAccountFormError] = useState<string | null>(null);
	const [accountDeleteError, setAccountDeleteError] = useState<string | null>(null);
	const [clearTradesError, setClearTradesError] = useState<string | null>(null);
	const [cashFormError, setCashFormError] = useState<string | null>(null);
	const [cashSaving, setCashSaving] = useState(false);

	const [name, setName] = useState("");
	const [broker, setBroker] = useState("");
	const [accountType, setAccountType] = useState("cash");
	const [baseCurrency, setBaseCurrency] = useState("USD");
	const [startingBalance, setStartingBalance] = useState("");

	const tradesQ = useTrades({});
	const trades = tradesQ.data ?? [];
	const primaryId = useMemo(() => primaryAccountId(accounts), [accounts]);
	const tradeCountByAccount = useMemo(() => {
		const counts = new Map<string, number>();
		for (const trade of trades) {
			counts.set(trade.account_id, (counts.get(trade.account_id) ?? 0) + 1);
		}
		return counts;
	}, [trades]);
	const cashCountByAccount = useMemo(() => {
		const counts = new Map<string, number>();
		for (const tx of cashTransactions) {
			counts.set(tx.account_id, (counts.get(tx.account_id) ?? 0) + 1);
		}
		return counts;
	}, [cashTransactions]);

	async function handleClearAccountTrades(id: string) {
		const name = accounts.find((account) => account.id === id)?.name ?? "Account";
		setClearTradesError(null);
		try {
			await onClearAccountTrades(id);
			toast.add({
				title: "Trade history cleared",
				description: `${name} — trades and executions removed.`,
			});
		} catch (err) {
			const message =
				err instanceof ApiError
					? err.message
					: "Failed to clear trade history.";
			setClearTradesError(message);
			toast.add({ title: "Could not clear trades", description: message });
		}
	}

	async function handleDeleteAccount(id: string) {
		const name = accounts.find((account) => account.id === id)?.name ?? "Account";
		setAccountDeleteError(null);
		try {
			await onDeleteAccount(id);
			toast.add({ title: "Account deleted", description: name });
		} catch (err) {
			const message =
				err instanceof ApiError
					? err.message
					: "Failed to delete account.";
			setAccountDeleteError(message);
			toast.add({ title: "Could not delete account", description: message });
		}
	}

	async function handleDeleteCash(id: string) {
		try {
			await onDeleteCash(id);
			toast.add({ title: "Transaction removed" });
		} catch (err) {
			toast.add({
				title: "Could not remove transaction",
				description: err instanceof Error ? err.message : "Request failed",
			});
		}
	}

	const cashForm = useForm({
		defaultValues: {
			accountId: accounts[0]?.id ?? "",
			type: "deposit",
			amount: "",
			occurredAt: new Date().toISOString().slice(0, 10),
			note: "",
		},
		onSubmit: async ({ value }) => {
			const amt = Number.parseFloat(value.amount);
			const acct = accounts.find((a) => a.id === value.accountId);
			setCashSaving(true);
			setCashFormError(null);
			try {
				await onCreateCash({
					account_id: value.accountId,
					type: value.type,
					amount: signedCashAmount(value.type, amt),
					currency: acct?.base_currency ?? "USD",
					occurred_at: `${value.occurredAt}T00:00:00Z`,
					note: value.note.trim() || undefined,
				});
				cashForm.reset();
				cashForm.setFieldValue("accountId", accounts[0]?.id ?? "");
				setShowCashForm(false);
			} catch {
				setCashFormError("Failed to create transaction.");
			} finally {
				setCashSaving(false);
			}
		},
	});

	useEffect(() => {
		if (accounts[0]?.id && !cashForm.state.values.accountId) {
			cashForm.setFieldValue("accountId", accounts[0].id);
		}
	}, [accounts, cashForm]);

	async function handleCreateAccount() {
		if (!name.trim()) {
			setAccountFormError("Name is required.");
			return;
		}
		const balance = Number.parseFloat(startingBalance);
		if (Number.isNaN(balance)) {
			setAccountFormError("Starting balance must be a number.");
			return;
		}
		setAccountSaving(true);
		setAccountFormError(null);
		try {
			await onCreateAccount({
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
			setShowAccountForm(false);
		} catch {
			setAccountFormError("Failed to create account.");
		} finally {
			setAccountSaving(false);
		}
	}

	const sortedTx = useMemo(
		() =>
			[...cashTransactions].sort(
				(a, b) =>
					new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
			),
		[cashTransactions],
	);

	const displayedTx = useMemo(() => {
		if (!filterAccountId) return sortedTx;
		return sortedTx.filter((tx) => tx.account_id === filterAccountId);
	}, [filterAccountId, sortedTx]);

	const filteredAccount = accounts.find((a) => a.id === filterAccountId);

	function openFundingForm(accountId: string, type: "deposit" | "withdrawal") {
		cashForm.setFieldValue("accountId", accountId);
		cashForm.setFieldValue("type", type);
		cashForm.setFieldValue("amount", "");
		cashForm.setFieldValue("note", "");
		cashForm.setFieldValue("occurredAt", new Date().toISOString().slice(0, 10));
		setFilterAccountId(accountId);
		setCashFormError(null);
		setShowCashForm(true);
		queueMicrotask(() => {
			const el = document.getElementById("settings-funding");
			el?.scrollIntoView?.({ behavior: "smooth", block: "start" });
		});
	}

	return (
		<>
			<SettingsSection
				title="Accounts"
				description="Broker accounts used for trade grouping and filters."
				action={
					<BtnGhost active={showAccountForm} onClick={() => setShowAccountForm((v) => !v)}>
						<Plus size={13} strokeWidth={1.5} />
						Add account
					</BtnGhost>
				}
			>
				{showAccountForm && (
					<SettingsInsetForm>
						<div className="flex flex-col gap-3">
							<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
								<SignalField label="Name" htmlFor="acct-name">
									<SignalInput
										id="acct-name"
										value={name}
										onChange={(e) => setName(e.target.value)}
										placeholder="e.g. Main Account"
									/>
								</SignalField>
								<SignalField label="Broker" htmlFor="acct-broker">
									<SignalInput
										id="acct-broker"
										value={broker}
										onChange={(e) => setBroker(e.target.value)}
										placeholder="e.g. IBKR"
									/>
								</SignalField>
							</div>
							<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
								<SignalField label="Account type">
									<SignalSelect
										value={accountType}
										onValueChange={setAccountType}
										ariaLabel="Account type"
										options={[
											{ value: "cash", label: "Cash" },
											{ value: "margin", label: "Margin" },
											{ value: "prop", label: "Prop" },
										]}
										triggerClassName="h-8 text-[12px]"
									/>
								</SignalField>
								<SignalField label="Base currency" htmlFor="acct-currency">
									<SignalInput
										id="acct-currency"
										value={baseCurrency}
										onChange={(e) => setBaseCurrency(e.target.value)}
										placeholder="USD"
									/>
								</SignalField>
								<SignalField label="Starting balance" htmlFor="acct-balance">
									<SignalInput
										id="acct-balance"
										type="number"
										value={startingBalance}
										onChange={(e) => setStartingBalance(e.target.value)}
										placeholder="0.00"
									/>
								</SignalField>
							</div>
							<FormError message={accountFormError} />
							<div className="flex items-center gap-2">
								<BtnPrimary disabled={accountSaving} onClick={() => void handleCreateAccount()}>
									<Check size={12} strokeWidth={1.5} />
									{accountSaving ? "Creating…" : "Create"}
								</BtnPrimary>
								<BtnGhost
									onClick={() => {
										setShowAccountForm(false);
										setAccountFormError(null);
									}}
								>
									<X size={12} strokeWidth={1.5} />
									Cancel
								</BtnGhost>
							</div>
						</div>
					</SettingsInsetForm>
				)}

				{accountsLoading ? (
					<div className="flex flex-col gap-2">
						{Array.from({ length: 3 }).map((_, i) => (
							<Skeleton key={i} height="40px" />
						))}
					</div>
				) : accountsError ? (
					<p className="text-[12px] text-loss">Failed to load accounts.</p>
				) : accounts.length === 0 ? (
					<EmptyState
						title="No accounts yet"
						hint="Add an account to get started."
						icon={<Settings size={28} strokeWidth={1.5} />}
					/>
				) : (
					<>
						{accountDeleteError ? (
							<p className="mb-3 text-[11px] text-loss">
								{accountDeleteError}
							</p>
						) : null}
						{clearTradesError ? (
							<p className="mb-3 text-[11px] text-loss">
								{clearTradesError}
							</p>
						) : null}
						<SettingsGroup>
						{accounts.map((acc, index) => {
							const balance = ledgerBalance(acc, cashTransactions);
							const isPrimary = acc.id === primaryId;
							const isOnlyAccount = accounts.length === 1;
							const tradeCount = tradeCountByAccount.get(acc.id) ?? 0;
							const cashCount = cashCountByAccount.get(acc.id) ?? 0;
							const balanceLabel = balance.toLocaleString(intlLocale(), {
								style: "currency",
								currency: acc.base_currency,
							});
							return (
								<AccountRow
									key={acc.id}
									last={index === accounts.length - 1}
									name={acc.name}
									broker={acc.broker}
									accountType={acc.account_type}
									currency={acc.base_currency}
									balance={balanceLabel}
									tradeCount={tradeCount}
									cashCount={cashCount}
									isPrimary={isPrimary}
									actions={
										<>
											<BtnToolbar
												aria-label={`Deposit to ${acc.name}`}
												onClick={() => openFundingForm(acc.id, "deposit")}
											>
												Deposit
											</BtnToolbar>
											<BtnToolbar
												aria-label={`Withdraw from ${acc.name}`}
												onClick={() => openFundingForm(acc.id, "withdrawal")}
											>
												Withdraw
											</BtnToolbar>
											<ClearTradesButton
												accountName={acc.name}
												tradeCount={tradeCount}
												onClear={() => void handleClearAccountTrades(acc.id)}
											/>
											{!isOnlyAccount ? (
												<DeleteButton
													label={acc.name}
													detail={accountRecordDetail(tradeCount, cashCount)}
													onDelete={() => void handleDeleteAccount(acc.id)}
												/>
											) : null}
										</>
									}
								/>
							);
						})}
					</SettingsGroup>
					</>
				)}
			</SettingsSection>

			<SettingsSection
				id="settings-funding"
				title="Deposits & withdrawals"
				description="Track cash flows that affect your equity curve and header cash stat."
				action={
					<BtnGhost
						active={showCashForm}
						onClick={() => {
							setShowCashForm((v) => {
								const next = !v;
								if (next) setFilterAccountId(null);
								return next;
							});
						}}
					>
						<Plus size={13} strokeWidth={1.5} />
						Add transaction
					</BtnGhost>
				}
			>
				{filterAccountId && filteredAccount && (
					<div className="mb-3 flex flex-wrap items-center gap-2">
						<span className="rounded-sharp border border-border bg-bg-inset px-2 py-1 text-[11px] text-text-muted">
							Filtered to {filteredAccount.name}
						</span>
						<BtnGhost
							className="px-2 py-1 text-[11px]"
							onClick={() => setFilterAccountId(null)}
						>
							Show all
						</BtnGhost>
					</div>
				)}
				{showCashForm && (
					<SettingsInsetForm>
						<form
							className="flex flex-col gap-3"
							onSubmit={(e) => {
								e.preventDefault();
								void cashForm.handleSubmit();
							}}
						>
							<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
								<cashForm.Field
									name="accountId"
									validators={{
										onSubmit: ({ value }) =>
											!value ? "Account is required." : undefined,
									}}
								>
									{(field) => (
										<SignalField
											label="Account"
											error={fieldError(field.state.meta.errors)}
										>
											<SignalSelect
												value={field.state.value}
												onValueChange={field.handleChange}
												ariaLabel="Cash account"
												options={accounts.map((a) => ({
													value: a.id,
													label: a.name,
												}))}
												triggerClassName="h-8 text-[12px]"
											/>
										</SignalField>
									)}
								</cashForm.Field>
								<cashForm.Field name="type">
									{(field) => (
										<SignalField label="Type">
											<SignalSelect
												value={field.state.value}
												onValueChange={field.handleChange}
												ariaLabel="Cash type"
												options={[
													{ value: "deposit", label: "Deposit" },
													{ value: "withdrawal", label: "Withdrawal" },
													{ value: "fee", label: "Fee" },
													{ value: "dividend", label: "Dividend" },
													{ value: "interest", label: "Interest" },
													{ value: "adjustment", label: "Adjustment" },
												]}
												triggerClassName="h-8 text-[12px]"
											/>
										</SignalField>
									)}
								</cashForm.Field>
							</div>
							<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
								<cashForm.Field
									name="amount"
									validators={{
										onSubmit: ({ value }) => {
											const amt = Number.parseFloat(value);
											if (Number.isNaN(amt) || amt <= 0) {
												return "Amount must be a positive number.";
											}
											return undefined;
										},
									}}
								>
									{(field) => (
										<SignalField
											label="Amount"
											htmlFor="cash-amount"
											error={fieldError(field.state.meta.errors)}
										>
											<SignalInput
												id="cash-amount"
												type="number"
												value={field.state.value}
												onBlur={field.handleBlur}
												onChange={(e) => field.handleChange(e.target.value)}
												placeholder="0.00"
											/>
										</SignalField>
									)}
								</cashForm.Field>
								<cashForm.Field name="occurredAt">
									{(field) => (
										<SignalField label="Date">
											<SignalDatePicker
												aria-label="Date"
												value={field.state.value}
												onChange={field.handleChange}
												onBlur={field.handleBlur}
											/>
										</SignalField>
									)}
								</cashForm.Field>
							</div>
							<cashForm.Field name="note">
								{(field) => (
									<SignalField label="Note" htmlFor="cash-note">
										<SignalInput
											id="cash-note"
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											placeholder="Optional note"
										/>
									</SignalField>
								)}
							</cashForm.Field>
							<FormError message={cashFormError} />
							<div className="flex items-center gap-2">
								<BtnPrimary type="submit" disabled={cashSaving}>
									<Check size={12} strokeWidth={1.5} />
									{cashSaving ? "Adding…" : "Add"}
								</BtnPrimary>
								<BtnGhost
									onClick={() => {
										setShowCashForm(false);
										setCashFormError(null);
									}}
								>
									<X size={12} strokeWidth={1.5} />
									Cancel
								</BtnGhost>
							</div>
						</form>
					</SettingsInsetForm>
				)}

				{cashLoading ? (
					<div className="flex flex-col gap-2">
						{Array.from({ length: 3 }).map((_, i) => (
							<Skeleton key={i} height="40px" />
						))}
					</div>
				) : cashError ? (
					<p className="text-[12px] text-loss">Failed to load transactions.</p>
				) : displayedTx.length === 0 ? (
					<EmptyState
						title={
							filterAccountId
								? "No transactions for this account"
								: "No transactions yet"
						}
						hint={
							filterAccountId
								? "Record a deposit or withdrawal for this account."
								: "Add a deposit or withdrawal to track balance changes."
						}
						icon={<Wallet size={28} strokeWidth={1.5} />}
					/>
				) : (
					<SettingsGroup>
						{displayedTx.map((tx, index) => {
							const acct = accounts.find((a) => a.id === tx.account_id);
							const display = formatCashDisplay(tx.type, tx.amount, tx.currency);
							const isOutflow = tx.amount < 0 || tx.type === "withdrawal" || tx.type === "fee";
							return (
								<SettingsRow
									key={tx.id}
									last={index === displayedTx.length - 1}
									primary={
										<span className="capitalize">
											{tx.type}
											{acct && (
												<span className="ml-2 font-normal text-text-muted">
													· {acct.name}
												</span>
											)}
										</span>
									}
									secondary={
										<>
											{new Date(tx.occurred_at).toLocaleDateString()}{" "}
											{tx.note && <span className="text-text-dim">· {tx.note}</span>}
										</>
									}
									actions={
										<div className="flex items-center gap-3">
											<span
												className={`text-[12px] tabular-nums ${isOutflow ? "text-loss" : "text-profit"}`}
											>
												{display}
											</span>
											<DeleteButton label={tx.type} onDelete={() => void handleDeleteCash(tx.id)} />
										</div>
									}
								/>
							);
						})}
					</SettingsGroup>
				)}
			</SettingsSection>
		</>
	);
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

export interface RulesTabProps {
	riskRules?: RiskRules;
	riskRulesLoading: boolean;
	riskRulesError: boolean;
	riskRulesSaving: boolean;
	onSaveRiskRules: (body: RiskRules) => Promise<void>;
	checklistItems: string[];
	checklistLoading: boolean;
	checklistError: boolean;
	checklistSaving: boolean;
	onSaveChecklist: (items: string[]) => Promise<void>;
}

export function RulesTab({
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
}: RulesTabProps) {
	const toast = useToastManager();
	const [maxRisk, setMaxRisk] = useState("");
	const [maxDaily, setMaxDaily] = useState("");
	const [maxOpen, setMaxOpen] = useState("");
	const [riskPct, setRiskPct] = useState("");
	const [riskFormError, setRiskFormError] = useState<string | null>(null);
	const [riskSaved, setRiskSaved] = useState(false);

	const [checklistText, setChecklistText] = useState(checklistItems.join("\n"));
	const [checklistSaved, setChecklistSaved] = useState(false);

	useEffect(() => {
		if (!riskRules) return;
		setMaxRisk(numOrEmpty(riskRules.max_risk_per_trade));
		setMaxDaily(numOrEmpty(riskRules.max_daily_loss));
		setMaxOpen(numOrEmpty(riskRules.max_open_risk));
		setRiskPct(numOrEmpty(riskRules.default_account_risk_pct));
	}, [riskRules]);

	useEffect(() => {
		setChecklistText(checklistItems.join("\n"));
	}, [checklistItems]);

	async function handleSaveRisk() {
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
			setRiskFormError("Enter valid numbers, or leave a field blank.");
			return;
		}
		if (
			body.default_account_risk_pct != null &&
			(body.default_account_risk_pct < 0 || body.default_account_risk_pct > 100)
		) {
			setRiskFormError("Default risk % must be between 0 and 100.");
			return;
		}
		setRiskFormError(null);
		setRiskSaved(false);
		try {
			await onSaveRiskRules(body);
			setRiskSaved(true);
		} catch {
			setRiskFormError("Could not save risk rules.");
		}
	}

	async function handleSaveChecklist() {
		const next = checklistText
			.split("\n")
			.map((l) => l.trim())
			.filter(Boolean);
		setChecklistSaved(false);
		try {
			await onSaveChecklist(next);
			setChecklistSaved(true);
		} catch (err) {
			toast.add({
				title: "Could not save checklist",
				description: err instanceof Error ? err.message : "Request failed",
			});
		}
	}

	return (
		<>
			<SettingsSection
				title="Risk Rules"
				description="Used by Check compliance on New Trade. Leave blank to skip a limit."
			>
				{riskRulesLoading ? (
					<Skeleton height="120px" />
				) : riskRulesError ? (
					<p className="text-[12px] text-loss">Failed to load risk rules.</p>
				) : (
					<div className="grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
						<SignalField label="Max risk / trade ($)" htmlFor="max-risk">
							<SignalInput
								id="max-risk"
								inputMode="decimal"
								value={maxRisk}
								onChange={(e) => setMaxRisk(e.target.value)}
								placeholder="e.g. 100"
								aria-label="Max risk per trade"
							/>
						</SignalField>
						<SignalField label="Max daily loss ($)" htmlFor="max-daily">
							<SignalInput
								id="max-daily"
								inputMode="decimal"
								value={maxDaily}
								onChange={(e) => setMaxDaily(e.target.value)}
								placeholder="e.g. 300"
								aria-label="Max daily loss"
							/>
						</SignalField>
						<SignalField label="Max open risk ($)" htmlFor="max-open">
							<SignalInput
								id="max-open"
								inputMode="decimal"
								value={maxOpen}
								onChange={(e) => setMaxOpen(e.target.value)}
								placeholder="e.g. 500"
								aria-label="Max open risk"
							/>
						</SignalField>
						<SignalField label="Default account risk %" htmlFor="risk-pct">
							<SignalInput
								id="risk-pct"
								inputMode="decimal"
								value={riskPct}
								onChange={(e) => setRiskPct(e.target.value)}
								placeholder="e.g. 1"
								aria-label="Default account risk percent"
							/>
						</SignalField>
					</div>
				)}
				<FormError message={riskFormError} />
				{!riskRulesLoading && !riskRulesError && (
					<div className="mt-4 flex items-center gap-3">
						<BtnPrimary disabled={riskRulesSaving} onClick={() => void handleSaveRisk()}>
							<Shield size={12} strokeWidth={1.5} />
							{riskRulesSaving ? "Saving…" : "Save rules"}
						</BtnPrimary>
						<SavedBadge show={riskSaved} />
					</div>
				)}
			</SettingsSection>

			<SettingsSection
				title="Daily Checklist"
				description="Pre-market / EOD checklist shown when you create a New Note. One item per line."
			>
				{checklistLoading ? (
					<Skeleton height="100px" />
				) : checklistError ? (
					<p className="text-[12px] text-loss">Failed to load checklist template.</p>
				) : (
					<SignalField label="Checklist items" htmlFor="checklist-items">
						<SignalTextarea
							id="checklist-items"
							aria-label="Daily checklist items"
							value={checklistText}
							onChange={(e) => setChecklistText(e.target.value)}
							rows={5}
							placeholder={"Check VIX\nNo revenge trades\nSize within risk"}
						/>
					</SignalField>
				)}
				{!checklistLoading && !checklistError && (
					<div className="mt-4 flex items-center gap-3">
						<BtnPrimary disabled={checklistSaving} onClick={() => void handleSaveChecklist()}>
							{checklistSaving ? "Saving…" : "Save checklist"}
						</BtnPrimary>
						<SavedBadge show={checklistSaved} />
					</div>
				)}
			</SettingsSection>
		</>
	);
}

// ---------------------------------------------------------------------------
// Journal (tags + setups)
// ---------------------------------------------------------------------------

export interface JournalTabProps {
	tags: TagType[];
	tagsLoading: boolean;
	tagsError: boolean;
	onCreateTag: (body: {
		name: string;
		color?: string;
		kind?: string;
	}) => Promise<void>;
	onDeleteTag: (id: string) => Promise<void>;
	setups: Setup[];
	setupsLoading: boolean;
	setupsError: boolean;
	onCreateSetup: (name: string, description: string) => Promise<void>;
	onDeleteSetup: (id: string) => Promise<void>;
}

export function JournalTab({
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
}: JournalTabProps) {
	const toast = useToastManager();
	const [showTagForm, setShowTagForm] = useState(false);
	const [tagName, setTagName] = useState("");
	const [tagColor, setTagColor] = useState("#6366f1");
	const [tagKind, setTagKind] = useState("custom");
	const [tagSaving, setTagSaving] = useState(false);
	const [tagFormError, setTagFormError] = useState<string | null>(null);

	const [showSetupForm, setShowSetupForm] = useState(false);
	const [setupName, setSetupName] = useState("");
	const [setupDescription, setSetupDescription] = useState("");
	const [setupSaving, setSetupSaving] = useState(false);
	const [setupFormError, setSetupFormError] = useState<string | null>(null);

	async function handleDeleteTag(id: string) {
		const name = tags.find((tag) => tag.id === id)?.name ?? "Tag";
		try {
			await onDeleteTag(id);
			toast.add({ title: "Tag deleted", description: name });
		} catch (err) {
			toast.add({
				title: "Could not delete tag",
				description: err instanceof Error ? err.message : "Request failed",
			});
		}
	}

	async function handleDeleteSetup(id: string) {
		const name = setups.find((setup) => setup.id === id)?.name ?? "Setup";
		try {
			await onDeleteSetup(id);
			toast.add({ title: "Setup deleted", description: name });
		} catch (err) {
			toast.add({
				title: "Could not delete setup",
				description: err instanceof Error ? err.message : "Request failed",
			});
		}
	}

	async function handleCreateTag() {
		if (!tagName.trim()) {
			setTagFormError("Name is required.");
			return;
		}
		setTagSaving(true);
		setTagFormError(null);
		try {
			await onCreateTag({ name: tagName.trim(), color: tagColor, kind: tagKind });
			setTagName("");
			setTagColor("#6366f1");
			setTagKind("custom");
			setShowTagForm(false);
		} catch {
			setTagFormError("Failed to create tag.");
		} finally {
			setTagSaving(false);
		}
	}

	async function handleCreateSetup() {
		if (!setupName.trim()) {
			setSetupFormError("Name is required.");
			return;
		}
		setSetupSaving(true);
		setSetupFormError(null);
		try {
			await onCreateSetup(setupName.trim(), setupDescription.trim());
			setSetupName("");
			setSetupDescription("");
			setShowSetupForm(false);
		} catch {
			setSetupFormError("Failed to create setup.");
		} finally {
			setSetupSaving(false);
		}
	}

	return (
		<>
			<SettingsSection
				title="Tags"
				description="Annotate trades with mistakes, habits, and custom labels."
				action={
					<BtnGhost active={showTagForm} onClick={() => setShowTagForm((v) => !v)}>
						<Plus size={13} strokeWidth={1.5} />
						Add tag
					</BtnGhost>
				}
			>
				{showTagForm && (
					<SettingsInsetForm>
						<div className="flex flex-col gap-3">
							<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
								<SignalField label="Name" htmlFor="tag-name">
									<SignalInput
										id="tag-name"
										value={tagName}
										onChange={(e) => setTagName(e.target.value)}
										placeholder="e.g. FOMO"
									/>
								</SignalField>
								<SignalField label="Color" htmlFor="tag-color">
									<input
										id="tag-color"
										type="color"
										value={tagColor}
										onChange={(e) => setTagColor(e.target.value)}
										className="h-8 w-full cursor-pointer rounded-control border border-border bg-bg-inset p-0.5"
									/>
								</SignalField>
								<SignalField label="Kind">
									<SignalSelect
										value={tagKind}
										onValueChange={setTagKind}
										ariaLabel="Tag kind"
										options={[
											{ value: "custom", label: "Custom" },
											{ value: "mistake", label: "Mistake" },
										]}
										triggerClassName="h-8 text-[12px]"
									/>
								</SignalField>
							</div>
							<FormError message={tagFormError} />
							<div className="flex items-center gap-2">
								<BtnPrimary disabled={tagSaving} onClick={() => void handleCreateTag()}>
									<Check size={12} strokeWidth={1.5} />
									{tagSaving ? "Creating…" : "Create"}
								</BtnPrimary>
								<BtnGhost
									onClick={() => {
										setShowTagForm(false);
										setTagFormError(null);
									}}
								>
									<X size={12} strokeWidth={1.5} />
									Cancel
								</BtnGhost>
							</div>
						</div>
					</SettingsInsetForm>
				)}

				{tagsLoading ? (
					<div className="flex flex-col gap-2">
						{Array.from({ length: 3 }).map((_, i) => (
							<Skeleton key={i} height="36px" />
						))}
					</div>
				) : tagsError ? (
					<p className="text-[12px] text-loss">Failed to load tags.</p>
				) : tags.length === 0 ? (
					<EmptyState
						title="No tags yet"
						hint="Create tags to annotate your trades."
						icon={<Tag size={28} strokeWidth={1.5} />}
					/>
				) : (
					<SettingsGroup>
						{tags.map((tag, index) => (
							<SettingsRow
								key={tag.id}
								last={index === tags.length - 1}
								primary={
									<span className="inline-flex items-center gap-2">
										<span
											className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
											style={{ background: tag.color || "#6366f1" }}
										/>
										{tag.name}
									</span>
								}
								secondary={<span className="capitalize">{tag.kind}</span>}
								actions={<DeleteButton label={tag.name} onDelete={() => void handleDeleteTag(tag.id)} />}
							/>
						))}
					</SettingsGroup>
				)}
			</SettingsSection>

			<SettingsSection
				title="Setups"
				description="Playbook patterns linked from the New Trade drawer."
				action={
					<BtnGhost active={showSetupForm} onClick={() => setShowSetupForm((v) => !v)}>
						<Plus size={13} strokeWidth={1.5} />
						Add setup
					</BtnGhost>
				}
			>
				{showSetupForm && (
					<SettingsInsetForm>
						<div className="flex flex-col gap-3">
							<SignalField label="Name" htmlFor="setup-name">
								<SignalInput
									id="setup-name"
									value={setupName}
									onChange={(e) => setSetupName(e.target.value)}
									placeholder="e.g. ORB, VWAP Fade"
								/>
							</SignalField>
							<SignalField label="Description" htmlFor="setup-desc">
								<SignalInput
									id="setup-desc"
									value={setupDescription}
									onChange={(e) => setSetupDescription(e.target.value)}
									placeholder="Optional notes"
								/>
							</SignalField>
							<FormError message={setupFormError} />
							<div className="flex items-center gap-2">
								<BtnPrimary disabled={setupSaving} onClick={() => void handleCreateSetup()}>
									<Check size={12} strokeWidth={1.5} />
									{setupSaving ? "Creating…" : "Create"}
								</BtnPrimary>
								<BtnGhost
									onClick={() => {
										setShowSetupForm(false);
										setSetupFormError(null);
									}}
								>
									<X size={12} strokeWidth={1.5} />
									Cancel
								</BtnGhost>
							</div>
						</div>
					</SettingsInsetForm>
				)}

				{setupsLoading ? (
					<div className="flex flex-col gap-2">
						{Array.from({ length: 3 }).map((_, i) => (
							<Skeleton key={i} height="36px" />
						))}
					</div>
				) : setupsError ? (
					<p className="text-[12px] text-loss">Failed to load setups.</p>
				) : setups.length === 0 ? (
					<EmptyState
						title="No setups yet"
						hint="Create a setup to track your playbook strategies."
						icon={<BookOpen size={28} strokeWidth={1.5} />}
					/>
				) : (
					<SettingsGroup>
						{setups.map((setup, index) => (
							<SettingsRow
								key={setup.id}
								last={index === setups.length - 1}
								primary={setup.name}
								secondary={setup.description || undefined}
								actions={
									<DeleteButton label={setup.name} onDelete={() => void handleDeleteSetup(setup.id)} />
								}
							/>
						))}
					</SettingsGroup>
				)}
			</SettingsSection>
		</>
	);
}

// ---------------------------------------------------------------------------
// General
// ---------------------------------------------------------------------------

export function GeneralTab() {
	const { locale, setLocale } = useLocale();
	const signOut = useAuth((s) => s.signOut);

	return (
		<>
			<SettingsSection footer={settingsLabel(locale, "languageFooter")}>
				<SettingsGroup>
					<SettingsGroupRow label={settingsLabel(locale, "language")} last>
						<SignalSelect
							value={locale}
							onValueChange={(next) => {
								void setLocale(next);
							}}
							ariaLabel={settingsLabel(locale, "languageSelector")}
							options={LOCALE_OPTIONS}
							triggerClassName="h-8 min-w-[9rem] text-[12px]"
						/>
					</SettingsGroupRow>
				</SettingsGroup>
			</SettingsSection>

			<SettingsSection footer={settingsLabel(locale, "signOutFooter")}>
				<SettingsGroup>
					<SettingsGroupRow label={settingsLabel(locale, "session")} last>
						<button
							type="button"
							onClick={() => signOut()}
							className="inline-flex h-8 cursor-pointer items-center rounded-control px-3 text-[12px] font-medium text-text-muted transition-colors hover:bg-bg-hover hover:text-text"
						>
							{settingsLabel(locale, "signOut")}
						</button>
					</SettingsGroupRow>
				</SettingsGroup>
			</SettingsSection>
		</>
	);
}
