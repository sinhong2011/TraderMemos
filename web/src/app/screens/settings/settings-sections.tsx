import { useForm } from "@tanstack/react-form";
import { BookOpen, Check, Plus, Settings, Shield, Tag, Wallet, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "../../../components/EmptyState";
import { SegmentedControl } from "../../../components/SegmentedControl";
import { SignalAmountInput } from "../../../components/SignalAmountInput";
import { SignalDatePicker } from "../../../components/SignalDatePicker";
import { fieldError, SignalField } from "../../../components/SignalField";
import { ModelAutocomplete } from "../../../components/SignalAutocomplete";
import { SignalInput, SignalPasswordInput, SignalTextarea } from "../../../components/SignalInput";
import { SignalSelect } from "../../../components/SignalSelect";
import { Skeleton } from "../../../components/Skeleton";
import { useToastManager } from "../../../components/Toast";
import { Button } from "../../../components/ui/button";
import { ApiError } from "../../../lib/api/client";
import type { OcrSettings, RiskRules } from "../../../lib/api/settings";
import type { Account, CashTransaction, Setup, Tag as TagType } from "../../../lib/api/types";
import {
  useListOcrModels,
  useOcrSettings,
  useSaveOcrSettings,
  useTestOcrSettings,
} from "../../../lib/hooks/useOcrSettings";
import { useTrades } from "../../../lib/hooks/useTrades";
import { formatCashDisplay, signedCashAmount } from "../../../lib/cashAmount";
import { parseAmountToNumber } from "../../../lib/amountInput";
import { cn } from "../../../lib/cn";
import { intlLocale, LOCALE_OPTIONS, settingsLabel } from "../../../lib/locale";
import {
  ocrSettingsPutBody,
  ocrSettingsTestBody,
  ocrSettingsToFormValues,
} from "../../../lib/ocrSettingsForm";
import { useAuth } from "../../../lib/auth";
import { useJournalPrefs } from "../../../lib/journalPrefs";
import { useLocale } from "../../../i18n";
import { usePrivacyMode } from "../../../lib/displayPrefs";
import {
  defaultAccountFormValues,
  defaultCashFormValues,
  defaultRiskFormValues,
  defaultSetupFormValues,
  defaultTagFormValues,
  parseChecklistText,
  riskFormToBody,
  validateAccountId,
  validateOptionalAmountField,
  validatePositiveAmount,
  validateRequiredName,
  validateRiskForm,
  validateRiskPercent,
  validateStartingBalance,
} from "../../../lib/settingsFormSchema";
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
  return [...accounts].sort((a, b) => a.created_at.localeCompare(b.created_at))[0]?.id;
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
  usePrivacyMode();
  const toast = useToastManager();
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [showCashForm, setShowCashForm] = useState(false);
  const [filterAccountId, setFilterAccountId] = useState<string | null>(null);
  const [accountFormError, setAccountFormError] = useState<string | null>(null);
  const [accountDeleteError, setAccountDeleteError] = useState<string | null>(null);
  const [clearTradesError, setClearTradesError] = useState<string | null>(null);
  const [cashFormError, setCashFormError] = useState<string | null>(null);

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
      const message = err instanceof ApiError ? err.message : "Failed to clear trade history.";
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
      const message = err instanceof ApiError ? err.message : "Failed to delete account.";
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

  const accountForm = useForm({
    defaultValues: defaultAccountFormValues(),
    onSubmit: async ({ value }) => {
      setAccountFormError(null);
      try {
        await onCreateAccount({
          name: value.name.trim(),
          broker: value.broker.trim(),
          account_type: value.accountType,
          base_currency: value.baseCurrency.trim() || "USD",
          starting_balance: parseAmountToNumber(value.startingBalance) ?? 0,
        });
        accountForm.reset(defaultAccountFormValues());
        setShowAccountForm(false);
      } catch {
        setAccountFormError("Failed to create account.");
      }
    },
  });

  const cashForm = useForm({
    defaultValues: defaultCashFormValues(accounts[0]?.id ?? ""),
    onSubmit: async ({ value }) => {
      const amt = parseAmountToNumber(value.amount);
      if (amt == null) return;
      const acct = accounts.find((a) => a.id === value.accountId);
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
        cashForm.reset(defaultCashFormValues(accounts[0]?.id ?? ""));
        setShowCashForm(false);
      } catch {
        setCashFormError("Failed to create transaction.");
      }
    },
  });

  useEffect(() => {
    if (accounts[0]?.id && !cashForm.state.values.accountId) {
      cashForm.setFieldValue("accountId", accounts[0].id);
    }
  }, [accounts, cashForm]);

  const sortedTx = useMemo(
    () =>
      [...cashTransactions].sort(
        (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
      ),
    [cashTransactions],
  );

  const displayedTx = useMemo(() => {
    if (!filterAccountId) return sortedTx;
    return sortedTx.filter((tx) => tx.account_id === filterAccountId);
  }, [filterAccountId, sortedTx]);

  const filteredAccount = accounts.find((a) => a.id === filterAccountId);

  function openFundingForm(accountId: string, type: "deposit" | "withdrawal") {
    cashForm.reset(defaultCashFormValues(accountId));
    cashForm.setFieldValue("type", type);
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
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void accountForm.handleSubmit();
              }}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <accountForm.Field
                  name="name"
                  validators={{
                    onBlur: ({ value }) => validateRequiredName(value),
                    onSubmit: ({ value }) => validateRequiredName(value),
                  }}
                >
                  {(field) => (
                    <SignalField
                      label="Name"
                      htmlFor="acct-name"
                      error={fieldError(field.state.meta.errors)}
                    >
                      <SignalInput
                        id="acct-name"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="e.g. Main Account"
                      />
                    </SignalField>
                  )}
                </accountForm.Field>
                <accountForm.Field name="broker">
                  {(field) => (
                    <SignalField label="Broker" htmlFor="acct-broker">
                      <SignalInput
                        id="acct-broker"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="e.g. IBKR"
                      />
                    </SignalField>
                  )}
                </accountForm.Field>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <accountForm.Field name="accountType">
                  {(field) => (
                    <SignalField label="Account type">
                      <SignalSelect
                        value={field.state.value}
                        onValueChange={field.handleChange}
                        ariaLabel="Account type"
                        options={[
                          { value: "cash", label: "Cash" },
                          { value: "margin", label: "Margin" },
                          { value: "prop", label: "Prop" },
                        ]}
                        triggerClassName="h-8 text-[12px]"
                      />
                    </SignalField>
                  )}
                </accountForm.Field>
                <accountForm.Field name="baseCurrency">
                  {(field) => (
                    <SignalField label="Base currency" htmlFor="acct-currency">
                      <SignalInput
                        id="acct-currency"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="USD"
                      />
                    </SignalField>
                  )}
                </accountForm.Field>
                <accountForm.Field
                  name="startingBalance"
                  validators={{
                    onBlur: ({ value }) => validateStartingBalance(value),
                    onSubmit: ({ value }) => validateStartingBalance(value),
                  }}
                >
                  {(field) => (
                    <SignalField
                      label="Starting balance"
                      htmlFor="acct-balance"
                      error={fieldError(field.state.meta.errors)}
                    >
                      <SignalAmountInput
                        id="acct-balance"
                        value={field.state.value}
                        onValueChange={field.handleChange}
                        onBlur={field.handleBlur}
                        placeholder="0.00"
                        allowNegative
                      />
                    </SignalField>
                  )}
                </accountForm.Field>
              </div>
              <FormError message={accountFormError} />
              <div className="flex items-center gap-2">
                <accountForm.Subscribe selector={(s) => s.isSubmitting}>
                  {(accountSaving) => (
                    <BtnPrimary type="submit" disabled={accountSaving}>
                      <Check size={12} strokeWidth={1.5} />
                      {accountSaving ? "Creating…" : "Create"}
                    </BtnPrimary>
                  )}
                </accountForm.Subscribe>
                <BtnGhost
                  onClick={() => {
                    setShowAccountForm(false);
                    setAccountFormError(null);
                    accountForm.reset(defaultAccountFormValues());
                  }}
                >
                  <X size={12} strokeWidth={1.5} />
                  Cancel
                </BtnGhost>
              </div>
            </form>
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
              <p className="mb-3 text-[11px] text-loss">{accountDeleteError}</p>
            ) : null}
            {clearTradesError ? (
              <p className="mb-3 text-[11px] text-loss">{clearTradesError}</p>
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
            <BtnGhost className="px-2 py-1 text-[11px]" onClick={() => setFilterAccountId(null)}>
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
                    onSubmit: ({ value }) => validateAccountId(value),
                  }}
                >
                  {(field) => (
                    <SignalField label="Account" error={fieldError(field.state.meta.errors)}>
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
                    onBlur: ({ value }) => validatePositiveAmount(value),
                    onSubmit: ({ value }) => validatePositiveAmount(value),
                  }}
                >
                  {(field) => (
                    <SignalField
                      label="Amount"
                      htmlFor="cash-amount"
                      error={fieldError(field.state.meta.errors)}
                    >
                      <SignalAmountInput
                        id="cash-amount"
                        value={field.state.value}
                        onValueChange={field.handleChange}
                        onBlur={field.handleBlur}
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
                <cashForm.Subscribe selector={(s) => s.isSubmitting}>
                  {(cashSaving) => (
                    <BtnPrimary type="submit" disabled={cashSaving}>
                      <Check size={12} strokeWidth={1.5} />
                      {cashSaving ? "Adding…" : "Add"}
                    </BtnPrimary>
                  )}
                </cashForm.Subscribe>
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
            title={filterAccountId ? "No transactions for this account" : "No transactions yet"}
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
                        <span className="ml-2 font-normal text-text-muted">· {acct.name}</span>
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
  const [riskFormError, setRiskFormError] = useState<string | null>(null);
  const [riskSaved, setRiskSaved] = useState(false);
  const [checklistSaved, setChecklistSaved] = useState(false);

  const riskForm = useForm({
    defaultValues: defaultRiskFormValues(riskRules),
    validators: {
      onSubmit: ({ value }) => validateRiskForm(value),
    },
    onSubmit: async ({ value }) => {
      setRiskFormError(null);
      setRiskSaved(false);
      try {
        await onSaveRiskRules(riskFormToBody(value));
        setRiskSaved(true);
      } catch {
        setRiskFormError("Could not save risk rules.");
      }
    },
  });

  const checklistForm = useForm({
    defaultValues: { text: checklistItems.join("\n") },
    onSubmit: async ({ value }) => {
      setChecklistSaved(false);
      try {
        await onSaveChecklist(parseChecklistText(value.text));
        setChecklistSaved(true);
      } catch (err) {
        toast.add({
          title: "Could not save checklist",
          description: err instanceof Error ? err.message : "Request failed",
        });
      }
    },
  });

  useEffect(() => {
    if (!riskRules) return;
    riskForm.reset(defaultRiskFormValues(riskRules));
  }, [riskRules]);

  useEffect(() => {
    checklistForm.reset({ text: checklistItems.join("\n") });
  }, [checklistItems]);

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
          <form
            className="grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              void riskForm.handleSubmit();
            }}
          >
            <riskForm.Field
              name="maxRisk"
              validators={{
                onBlur: ({ value }) => validateOptionalAmountField(value),
              }}
            >
              {(field) => (
                <SignalField
                  label="Max risk / trade ($)"
                  htmlFor="max-risk"
                  error={fieldError(field.state.meta.errors)}
                >
                  <SignalAmountInput
                    id="max-risk"
                    value={field.state.value}
                    onValueChange={field.handleChange}
                    onBlur={field.handleBlur}
                    placeholder="e.g. 100"
                    aria-label="Max risk per trade"
                  />
                </SignalField>
              )}
            </riskForm.Field>
            <riskForm.Field
              name="maxDaily"
              validators={{
                onBlur: ({ value }) => validateOptionalAmountField(value),
              }}
            >
              {(field) => (
                <SignalField
                  label="Max daily loss ($)"
                  htmlFor="max-daily"
                  error={fieldError(field.state.meta.errors)}
                >
                  <SignalAmountInput
                    id="max-daily"
                    value={field.state.value}
                    onValueChange={field.handleChange}
                    onBlur={field.handleBlur}
                    placeholder="e.g. 300"
                    aria-label="Max daily loss"
                  />
                </SignalField>
              )}
            </riskForm.Field>
            <riskForm.Field
              name="maxOpen"
              validators={{
                onBlur: ({ value }) => validateOptionalAmountField(value),
              }}
            >
              {(field) => (
                <SignalField
                  label="Max open risk ($)"
                  htmlFor="max-open"
                  error={fieldError(field.state.meta.errors)}
                >
                  <SignalAmountInput
                    id="max-open"
                    value={field.state.value}
                    onValueChange={field.handleChange}
                    onBlur={field.handleBlur}
                    placeholder="e.g. 500"
                    aria-label="Max open risk"
                  />
                </SignalField>
              )}
            </riskForm.Field>
            <riskForm.Field
              name="riskPct"
              validators={{
                onBlur: ({ value }) => validateRiskPercent(value),
                onSubmit: ({ value }) => validateRiskPercent(value),
              }}
            >
              {(field) => (
                <SignalField
                  label="Default account risk %"
                  htmlFor="risk-pct"
                  error={fieldError(field.state.meta.errors)}
                >
                  <SignalAmountInput
                    id="risk-pct"
                    value={field.state.value}
                    onValueChange={field.handleChange}
                    onBlur={field.handleBlur}
                    placeholder="e.g. 1"
                    aria-label="Default account risk percent"
                  />
                </SignalField>
              )}
            </riskForm.Field>
            <div className="col-span-full">
              <riskForm.Subscribe selector={(s) => s.errorMap.onSubmit}>
                {(submitErr) => (
                  <FormError
                    message={riskFormError ?? (typeof submitErr === "string" ? submitErr : null)}
                  />
                )}
              </riskForm.Subscribe>
              <div className="mt-4 flex items-center gap-3">
                <BtnPrimary type="submit" disabled={riskRulesSaving}>
                  <Shield size={12} strokeWidth={1.5} />
                  {riskRulesSaving ? "Saving…" : "Save rules"}
                </BtnPrimary>
                <SavedBadge show={riskSaved} />
              </div>
            </div>
          </form>
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
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void checklistForm.handleSubmit();
            }}
          >
            <checklistForm.Field name="text">
              {(field) => (
                <SignalField label="Checklist items" htmlFor="checklist-items">
                  <SignalTextarea
                    id="checklist-items"
                    aria-label="Daily checklist items"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    rows={5}
                    placeholder={"Check VIX\nNo revenge trades\nSize within risk"}
                  />
                </SignalField>
              )}
            </checklistForm.Field>
            <div className="mt-4 flex items-center gap-3">
              <BtnPrimary type="submit" disabled={checklistSaving}>
                {checklistSaving ? "Saving…" : "Save checklist"}
              </BtnPrimary>
              <SavedBadge show={checklistSaved} />
            </div>
          </form>
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
  onCreateTag: (body: { name: string; color?: string; kind?: string }) => Promise<void>;
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
  const [tagFormError, setTagFormError] = useState<string | null>(null);
  const [showSetupForm, setShowSetupForm] = useState(false);
  const [setupFormError, setSetupFormError] = useState<string | null>(null);

  const tagForm = useForm({
    defaultValues: defaultTagFormValues(),
    onSubmit: async ({ value }) => {
      setTagFormError(null);
      try {
        await onCreateTag({
          name: value.name.trim(),
          color: value.color,
          kind: value.kind,
        });
        tagForm.reset(defaultTagFormValues());
        setShowTagForm(false);
      } catch {
        setTagFormError("Failed to create tag.");
      }
    },
  });

  const setupForm = useForm({
    defaultValues: defaultSetupFormValues(),
    onSubmit: async ({ value }) => {
      setSetupFormError(null);
      try {
        await onCreateSetup(value.name.trim(), value.description.trim());
        setupForm.reset(defaultSetupFormValues());
        setShowSetupForm(false);
      } catch {
        setSetupFormError("Failed to create setup.");
      }
    },
  });

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
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void tagForm.handleSubmit();
              }}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <tagForm.Field
                  name="name"
                  validators={{
                    onBlur: ({ value }) => validateRequiredName(value),
                    onSubmit: ({ value }) => validateRequiredName(value),
                  }}
                >
                  {(field) => (
                    <SignalField
                      label="Name"
                      htmlFor="tag-name"
                      error={fieldError(field.state.meta.errors)}
                    >
                      <SignalInput
                        id="tag-name"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="e.g. FOMO"
                      />
                    </SignalField>
                  )}
                </tagForm.Field>
                <tagForm.Field name="color">
                  {(field) => (
                    <SignalField label="Color" htmlFor="tag-color">
                      <input
                        id="tag-color"
                        type="color"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        className="h-8 w-full cursor-pointer rounded-control border-none bg-bg-input p-0.5"
                      />
                    </SignalField>
                  )}
                </tagForm.Field>
                <tagForm.Field name="kind">
                  {(field) => (
                    <SignalField label="Kind">
                      <SignalSelect
                        value={field.state.value}
                        onValueChange={field.handleChange}
                        ariaLabel="Tag kind"
                        options={[
                          { value: "custom", label: "Custom" },
                          { value: "mistake", label: "Mistake" },
                        ]}
                        triggerClassName="h-8 text-[12px]"
                      />
                    </SignalField>
                  )}
                </tagForm.Field>
              </div>
              <FormError message={tagFormError} />
              <div className="flex items-center gap-2">
                <tagForm.Subscribe selector={(s) => s.isSubmitting}>
                  {(tagSaving) => (
                    <BtnPrimary type="submit" disabled={tagSaving}>
                      <Check size={12} strokeWidth={1.5} />
                      {tagSaving ? "Creating…" : "Create"}
                    </BtnPrimary>
                  )}
                </tagForm.Subscribe>
                <BtnGhost
                  onClick={() => {
                    setShowTagForm(false);
                    setTagFormError(null);
                    tagForm.reset(defaultTagFormValues());
                  }}
                >
                  <X size={12} strokeWidth={1.5} />
                  Cancel
                </BtnGhost>
              </div>
            </form>
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
                actions={
                  <DeleteButton label={tag.name} onDelete={() => void handleDeleteTag(tag.id)} />
                }
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
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void setupForm.handleSubmit();
              }}
            >
              <setupForm.Field
                name="name"
                validators={{
                  onBlur: ({ value }) => validateRequiredName(value),
                  onSubmit: ({ value }) => validateRequiredName(value),
                }}
              >
                {(field) => (
                  <SignalField
                    label="Name"
                    htmlFor="setup-name"
                    error={fieldError(field.state.meta.errors)}
                  >
                    <SignalInput
                      id="setup-name"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="e.g. ORB, VWAP Fade"
                    />
                  </SignalField>
                )}
              </setupForm.Field>
              <setupForm.Field name="description">
                {(field) => (
                  <SignalField label="Description" htmlFor="setup-desc">
                    <SignalInput
                      id="setup-desc"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="Optional notes"
                    />
                  </SignalField>
                )}
              </setupForm.Field>
              <FormError message={setupFormError} />
              <div className="flex items-center gap-2">
                <setupForm.Subscribe selector={(s) => s.isSubmitting}>
                  {(setupSaving) => (
                    <BtnPrimary type="submit" disabled={setupSaving}>
                      <Check size={12} strokeWidth={1.5} />
                      {setupSaving ? "Creating…" : "Create"}
                    </BtnPrimary>
                  )}
                </setupForm.Subscribe>
                <BtnGhost
                  onClick={() => {
                    setShowSetupForm(false);
                    setSetupFormError(null);
                    setupForm.reset(defaultSetupFormValues());
                  }}
                >
                  <X size={12} strokeWidth={1.5} />
                  Cancel
                </BtnGhost>
              </div>
            </form>
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
                  <DeleteButton
                    label={setup.name}
                    onDelete={() => void handleDeleteSetup(setup.id)}
                  />
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

function VisionScanSection() {
  const { locale } = useLocale();
  const { data, isPending, isError } = useOcrSettings();

  return (
    <SettingsSection
      title={settingsLabel(locale, "visionScan")}
      footer={settingsLabel(locale, "visionScanFooter")}
    >
      {isPending && !data ? (
        <Skeleton height="160px" />
      ) : isError || !data ? (
        <p className="text-[12px] text-loss">Failed to load vision settings.</p>
      ) : (
        <VisionScanForm settings={data} />
      )}
    </SettingsSection>
  );
}

function VisionScanForm({ settings }: { settings: OcrSettings }) {
  const { locale } = useLocale();
  const toast = useToastManager();
  const save = useSaveOcrSettings();
  const test = useTestOcrSettings();
  const listModels = useListOcrModels();
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [modelOptions, setModelOptions] = useState<string[]>([]);

  const form = useForm({
    defaultValues: ocrSettingsToFormValues(settings),
    onSubmit: async ({ value }) => {
      setFormError(null);
      setSaved(false);
      try {
        const body = ocrSettingsPutBody(value);
        await save.mutateAsync(body);
        form.setFieldValue("enabled", body.enabled);
        form.setFieldValue("base_url", body.base_url);
        form.setFieldValue("model", body.model);
        form.setFieldValue("custom_prompt", body.custom_prompt);
        form.setFieldValue("api_key", "");
        setSaved(true);
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Could not save vision settings.");
      }
    },
  });

  const onTest = async () => {
    const draft = { ...form.state.values };
    try {
      setFormError(null);
      const result = await test.mutateAsync(ocrSettingsTestBody(draft));

      // Keep user-entered values even if background query updates occur.
      form.setFieldValue("enabled", draft.enabled);
      form.setFieldValue("base_url", draft.base_url);
      form.setFieldValue("model", draft.model);
      form.setFieldValue("custom_prompt", draft.custom_prompt);
      form.setFieldValue("api_key", draft.api_key);

      if (result.ok) {
        toast.add({ title: "Connection OK", description: "Vision API responded." });
      } else {
        toast.add({
          title: "Connection failed",
          description: result.error || "Vision API rejected the request",
        });
      }
    } catch (err) {
      // Also restore values on failure so testing never clears user input.
      form.setFieldValue("enabled", draft.enabled);
      form.setFieldValue("base_url", draft.base_url);
      form.setFieldValue("model", draft.model);
      form.setFieldValue("custom_prompt", draft.custom_prompt);
      form.setFieldValue("api_key", draft.api_key);

      toast.add({
        title: "Connection failed",
        description: err instanceof Error ? err.message : "Request failed",
      });
    }
  };

  const onFetchModels = async () => {
    try {
      const value = form.state.values;
      const result = await listModels.mutateAsync({
        base_url: value.base_url.trim(),
        ...(value.api_key.trim() ? { api_key: value.api_key.trim() } : {}),
      });
      if (result.error) {
        toast.add({
          title: settingsLabel(locale, "visionFetchModels"),
          description: result.error,
        });
        return;
      }
      setModelOptions(result.models);
      toast.add({
        title: settingsLabel(locale, "visionFetchModels"),
        description: `${result.models.length} models`,
      });
    } catch (err) {
      toast.add({
        title: settingsLabel(locale, "visionFetchModels"),
        description: err instanceof Error ? err.message : "Request failed",
      });
    }
  };

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <SettingsGroup>
        <form.Field name="enabled">
          {(field) => (
            <SettingsGroupRow label={settingsLabel(locale, "visionEnabled")} last>
              <SegmentedControl
                options={[
                  { value: "off", label: settingsLabel(locale, "visionOff") },
                  { value: "on", label: settingsLabel(locale, "visionOn") },
                ]}
                value={field.state.value ? "on" : "off"}
                onChange={(v) => field.handleChange(v === "on")}
              />
            </SettingsGroupRow>
          )}
        </form.Field>
      </SettingsGroup>
      <form.Subscribe selector={(s) => s.values.enabled}>
        {(enabled) => (
          <fieldset
            disabled={!enabled}
            className={cn(
              "m-0 min-w-0 border-none p-0 transition-opacity duration-150",
              !enabled && "opacity-45",
            )}
          >
            <SettingsGroup>
              <form.Field name="base_url">
                {(field) => (
                  <SettingsGroupRow label={settingsLabel(locale, "visionBaseUrl")}>
                    <div className="relative w-full min-w-[19.2rem]">
                      <SignalInput
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="https://api.openai.com/v1"
                        spellCheck={false}
                        className="h-8 w-full pr-10 text-[12px]"
                        aria-label={settingsLabel(locale, "visionBaseUrl")}
                      />
                      {field.state.value ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="absolute top-1/2 right-1 -translate-y-1/2"
                          aria-label="Clear base URL"
                          onClick={() => field.handleChange("")}
                        >
                          <X size={13} strokeWidth={1.75} aria-hidden />
                        </Button>
                      ) : null}
                    </div>
                  </SettingsGroupRow>
                )}
              </form.Field>
              <form.Field name="model">
                {(field) => (
                  <SettingsGroupRow label={settingsLabel(locale, "visionModel")}>
                    <ModelAutocomplete
                      value={field.state.value}
                      onValueChange={(next) => field.handleChange(next)}
                      models={modelOptions}
                      onFetchModels={() => void onFetchModels()}
                      fetching={listModels.isPending}
                      fetchLabel={
                        listModels.isPending
                          ? settingsLabel(locale, "visionFetchingModels")
                          : settingsLabel(locale, "visionFetchModels")
                      }
                      placeholder="gpt-4o-mini"
                      className="w-full min-w-[19.2rem]"
                      inputClassName="h-8 w-full text-[12px]"
                      ariaLabel={settingsLabel(locale, "visionModel")}
                    />
                  </SettingsGroupRow>
                )}
              </form.Field>
              <form.Field name="api_key">
                {(field) => (
                  <SettingsGroupRow label={settingsLabel(locale, "visionApiKey")}>
                    <div className="flex min-w-0 flex-col items-end gap-1">
                      <SignalPasswordInput
                        autoComplete="off"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onClear={() => field.handleChange("")}
                        placeholder={
                          settings.api_key_set
                            ? settings.api_key_hint || settingsLabel(locale, "visionApiKeyHint")
                            : "sk-…"
                        }
                        spellCheck={false}
                        className="h-8 min-w-[19.2rem] text-[12px]"
                        aria-label={settingsLabel(locale, "visionApiKey")}
                        showLabel="Show API key"
                        hideLabel="Hide API key"
                        clearLabel="Clear API key"
                      />
                      {settings.api_key_set ? (
                        <span className="text-[10px] text-text-dim">
                          {settingsLabel(locale, "visionApiKeyHint")}
                        </span>
                      ) : null}
                    </div>
                  </SettingsGroupRow>
                )}
              </form.Field>
              <form.Field name="custom_prompt">
                {(field) => (
                  <SettingsGroupRow
                    label={settingsLabel(locale, "visionCustomPrompt")}
                    detail={settingsLabel(locale, "visionCustomPromptHint")}
                    last
                  >
                    <SignalTextarea
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder={
                        settings.default_prompt || settingsLabel(locale, "visionCustomPromptHint")
                      }
                      spellCheck={false}
                      rows={8}
                      className="min-h-[10rem] min-w-[19.2rem] whitespace-pre-wrap text-[11px] leading-snug"
                      aria-label={settingsLabel(locale, "visionCustomPrompt")}
                    />
                  </SettingsGroupRow>
                )}
              </form.Field>
            </SettingsGroup>
          </fieldset>
        )}
      </form.Subscribe>
      {formError ? <FormError message={formError} /> : null}
      <div className="flex flex-wrap items-center gap-2">
        <BtnPrimary type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving…" : settingsLabel(locale, "visionSave")}
        </BtnPrimary>
        <BtnGhost type="button" disabled={test.isPending} onClick={() => void onTest()}>
          {test.isPending
            ? settingsLabel(locale, "visionTesting")
            : settingsLabel(locale, "visionTest")}
        </BtnGhost>
        <SavedBadge show={saved} />
      </div>
    </form>
  );
}

export function GeneralTab() {
  const { locale, setLocale } = useLocale();
  const signOut = useAuth((s) => s.signOut);
  const maxScreenshots = useJournalPrefs((s) => s.maxScreenshotsPerTrade);
  const setMaxScreenshots = useJournalPrefs((s) => s.setMaxScreenshotsPerTrade);

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

      <SettingsSection footer={settingsLabel(locale, "screenshotsFooter")}>
        <SettingsGroup>
          <SettingsGroupRow label={settingsLabel(locale, "maxScreenshots")} last>
            <SignalInput
              type="number"
              min={1}
              max={100}
              inputMode="numeric"
              placeholder={settingsLabel(locale, "maxScreenshotsHint")}
              aria-label={settingsLabel(locale, "maxScreenshots")}
              value={maxScreenshots ?? ""}
              onChange={(e) => {
                const raw = e.target.value.trim();
                if (raw === "") {
                  setMaxScreenshots(null);
                  return;
                }
                setMaxScreenshots(Number(raw));
              }}
              className="h-8 w-[9rem] text-[12px]"
            />
          </SettingsGroupRow>
        </SettingsGroup>
      </SettingsSection>

      <VisionScanSection />

      <SettingsSection footer={settingsLabel(locale, "signOutFooter")}>
        <SettingsGroup>
          <SettingsGroupRow label={settingsLabel(locale, "session")} last>
            <Button type="button" variant="ghost" onClick={() => signOut()}>
              {settingsLabel(locale, "signOut")}
            </Button>
          </SettingsGroupRow>
        </SettingsGroup>
      </SettingsSection>
    </>
  );
}
