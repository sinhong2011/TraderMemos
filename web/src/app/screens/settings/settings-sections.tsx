import { useForm } from "@tanstack/react-form";
import {
  Check,
  Download,
  Pencil,
  Plus,
  Settings,
  Shield,
  Tag,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { EmptyState } from "../../../components/EmptyState";
import { LlmApiSettingsForm } from "../../../components/LlmApiSettingsForm";
import { Modal } from "../../../components/Modal";
import { SignalAmountInput } from "../../../components/SignalAmountInput";
import { SignalDatePicker } from "../../../components/SignalDatePicker";
import { fieldError, SignalField } from "../../../components/SignalField";
import { SignalInput, SignalTextarea } from "../../../components/SignalInput";
import { Skeleton } from "../../../components/Skeleton";
import { useToastManager } from "../../../components/Toast";
import { Button } from "../../../components/ui/button";
import { NativeSelect, NativeSelectOption } from "../../../components/ui/native-select";
import {
  ApiError,
  editableApiBaseUrl,
  getCustomApiBaseUrl,
  setBaseUrl,
} from "../../../lib/api/client";
import { applyParsedAppConfig, buildAppConfigExport, parseAppConfig } from "../../../lib/appConfig";
import type { RiskRules } from "../../../lib/api/settings";
import {
  useCoachSettings,
  useListCoachModels,
  useSaveCoachSettings,
  useTestCoachSettings,
} from "../../../lib/hooks/useCoachSettings";
import type { Account, CashTransaction, Tag as TagType } from "../../../lib/api/types";
import {
  useListOcrModels,
  useOcrSettings,
  useSaveOcrSettings,
  useTestOcrSettings,
} from "../../../lib/hooks/useOcrSettings";
import { useTrades } from "../../../lib/hooks/useTrades";
import { formatCashDisplay, signedCashAmount } from "../../../lib/cashAmount";
import { parseAmountToNumber } from "../../../lib/amountInput";
import { fmtDate, fmtMoney, fmtSignedMoney } from "../../../lib/format";
import {
  intlLocale,
  LOCALE_OPTIONS,
  settingsLabel,
  type SettingsLabelKey,
} from "../../../lib/locale";
import type { LlmApiSettingsLabels } from "../../../lib/llmApiSettings";
import { useAuth } from "../../../lib/auth";
import { useJournalPrefs } from "../../../lib/journalPrefs";
import { useLocale } from "../../../i18n";
import {
  TIME_FORMAT_OPTIONS,
  TRADE_DATE_BASIS_OPTIONS,
  timezoneSelectOptions,
  type TimeFormatPref,
  type TimezonePref,
  type TradeDateBasis,
  usePrivacyMode,
  useDisplayPrefs,
} from "../../../lib/displayPrefs";
import {
  defaultAccountFormValues,
  defaultCashFormValues,
  defaultRiskFormValues,
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
  ClearTradesButton,
  DeleteButton,
  FormError,
  SavedBadge,
  SettingsInsetForm,
  SettingsPanelBody,
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
  // Funded equity base is the cash ledger only. Opening balance is seeded as the
  // first deposit when the account is created, so starting_balance is metadata.
  return transactions
    .filter((t) => t.account_id === account.id)
    .reduce((sum, t) => sum + t.amount, 0);
}

const POPULAR_BROKERS = [
  "IBKR",
  "Webull",
  "Robinhood",
  "Fidelity",
  "Charles Schwab",
  "E*TRADE",
  "tastytrade",
  "Moomoo",
  "FUTU",
] as const;
const OTHER_BROKER_VALUE = "__other__";

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
  onUpdateAccount: (id: string, body: { name: string; broker: string }) => Promise<void>;
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
  onUpdateCash: (
    id: string,
    body: {
      type: string;
      amount: number;
      currency: string;
      occurred_at: string;
      note?: string;
    },
  ) => Promise<void>;
  onDeleteCash: (id: string) => Promise<void>;
}

export function AccountsTab({
  accounts,
  accountsLoading,
  accountsError,
  onCreateAccount,
  onDeleteAccount,
  onUpdateAccount,
  onClearAccountTrades,
  cashTransactions,
  cashLoading,
  cashError,
  onCreateCash,
  onUpdateCash,
  onDeleteCash,
}: AccountsTabProps) {
  usePrivacyMode();
  const toast = useToastManager();
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [showCashForm, setShowCashForm] = useState(false);
  const [filterAccountId, setFilterAccountId] = useState<string | null>(null);
  const [accountFormError, setAccountFormError] = useState<string | null>(null);
  const [accountDeleteError, setAccountDeleteError] = useState<string | null>(null);
  const [accountEditError, setAccountEditError] = useState<string | null>(null);
  const [clearTradesError, setClearTradesError] = useState<string | null>(null);
  const [cashFormError, setCashFormError] = useState<string | null>(null);
  const [editAccountId, setEditAccountId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editBrokerChoice, setEditBrokerChoice] = useState<string>(POPULAR_BROKERS[0]);
  const [editBrokerCustom, setEditBrokerCustom] = useState("");
  const [editingAccount, setEditingAccount] = useState(false);
  const [editCashId, setEditCashId] = useState<string | null>(null);
  const [editCashType, setEditCashType] = useState("deposit");
  const [editCashAmount, setEditCashAmount] = useState("");
  const [editCashDate, setEditCashDate] = useState("");
  const [editCashNote, setEditCashNote] = useState("");
  const [editCashCurrency, setEditCashCurrency] = useState("USD");
  const [editCashError, setEditCashError] = useState<string | null>(null);
  const [savingCash, setSavingCash] = useState(false);

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
  const netPnlByAccount = useMemo(() => {
    const totals = new Map<string, number>();
    for (const trade of trades) {
      if (typeof trade.net_pnl !== "number") continue;
      totals.set(trade.account_id, (totals.get(trade.account_id) ?? 0) + trade.net_pnl);
    }
    return totals;
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

  function startEditAccount(account: Account) {
    setAccountEditError(null);
    setEditAccountId(account.id);
    setEditName(account.name);
    const broker = account.broker.trim();
    if (POPULAR_BROKERS.includes(broker as (typeof POPULAR_BROKERS)[number])) {
      setEditBrokerChoice(broker);
      setEditBrokerCustom("");
    } else {
      setEditBrokerChoice(OTHER_BROKER_VALUE);
      setEditBrokerCustom(broker);
    }
  }

  function cancelEditAccount() {
    setAccountEditError(null);
    setEditAccountId(null);
    setEditName("");
    setEditBrokerChoice(POPULAR_BROKERS[0]);
    setEditBrokerCustom("");
    setEditingAccount(false);
  }

  async function handleSaveAccount(id: string) {
    const name = editName.trim();
    const broker =
      editBrokerChoice === OTHER_BROKER_VALUE ? editBrokerCustom.trim() : editBrokerChoice.trim();
    if (!name) {
      setAccountEditError("Account name is required.");
      return;
    }
    if (!broker) {
      setAccountEditError("Broker is required.");
      return;
    }
    setEditingAccount(true);
    setAccountEditError(null);
    try {
      await onUpdateAccount(id, { name, broker });
      toast.add({ title: "Account updated", description: name });
      cancelEditAccount();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to update account.";
      setAccountEditError(message);
      toast.add({ title: "Could not update account", description: message });
      setEditingAccount(false);
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

  function startEditCash(tx: CashTransaction) {
    setEditCashError(null);
    setEditCashId(tx.id);
    setEditCashType(tx.type);
    setEditCashAmount(String(Math.abs(tx.amount)));
    setEditCashDate(tx.occurred_at.slice(0, 10));
    setEditCashNote(tx.note ?? "");
    setEditCashCurrency(tx.currency || "USD");
  }

  function cancelEditCash() {
    setEditCashId(null);
    setEditCashError(null);
    setSavingCash(false);
  }

  async function handleSaveCash() {
    if (!editCashId) return;
    const amount = parseAmountToNumber(editCashAmount);
    if (amount == null || amount <= 0) {
      setEditCashError("Enter a valid amount.");
      return;
    }
    if (!editCashDate) {
      setEditCashError("Date is required.");
      return;
    }
    setSavingCash(true);
    setEditCashError(null);
    try {
      await onUpdateCash(editCashId, {
        type: editCashType,
        amount: signedCashAmount(editCashType, amount),
        currency: editCashCurrency || "USD",
        occurred_at: new Date(`${editCashDate}T12:00:00.000Z`).toISOString(),
        note: editCashNote.trim() || undefined,
      });
      toast.add({ title: "Transaction updated" });
      cancelEditCash();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to update transaction.";
      setEditCashError(message);
      toast.add({ title: "Could not update transaction", description: message });
      setSavingCash(false);
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
                      <NativeSelect
                        size="sm"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-label="Account type"
                        className="h-8 w-full text-[12px]"
                        wrapperClassName="w-full"
                      >
                        <NativeSelectOption value="cash">Cash</NativeSelectOption>
                        <NativeSelectOption value="margin">Margin</NativeSelectOption>
                        <NativeSelectOption value="prop">Prop</NativeSelectOption>
                      </NativeSelect>
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
                      description="Saved as the first deposit in the cash ledger."
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
          <SettingsPanelBody>
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} height="40px" />
              ))}
            </div>
          </SettingsPanelBody>
        ) : accountsError ? (
          <SettingsPanelBody>
            <p className="text-[12px] text-loss">Failed to load accounts.</p>
          </SettingsPanelBody>
        ) : accounts.length === 0 ? (
          <SettingsPanelBody className="py-8">
            <EmptyState
              title="No accounts yet"
              hint="Add an account to get started."
              icon={<Settings size={28} strokeWidth={1.5} />}
            />
          </SettingsPanelBody>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              {accountDeleteError ? (
                <p className="text-[11px] text-loss">{accountDeleteError}</p>
              ) : null}
              {accountEditError ? (
                <p className="text-[11px] text-loss">{accountEditError}</p>
              ) : null}
              {clearTradesError ? (
                <p className="text-[11px] text-loss">{clearTradesError}</p>
              ) : null}
              <div className="flex flex-col gap-2">
                {accounts.map((acc) => {
                  const balance = ledgerBalance(acc, cashTransactions);
                  const isPrimary = acc.id === primaryId;
                  const isOnlyAccount = accounts.length === 1;
                  const tradeCount = tradeCountByAccount.get(acc.id) ?? 0;
                  const netPnl = netPnlByAccount.get(acc.id) ?? 0;
                  const cashCount = cashCountByAccount.get(acc.id) ?? 0;
                  const locale = intlLocale();
                  const depositedLabel = fmtMoney(balance, acc.base_currency, locale);
                  const equity = balance + netPnl;
                  const equityLabel = fmtMoney(equity, acc.base_currency, locale);
                  const realizedPnlLabel = fmtSignedMoney(netPnl, acc.base_currency, locale);
                  const pnlPctLabel =
                    balance !== 0
                      ? (netPnl / balance).toLocaleString(locale, {
                          style: "percent",
                          maximumFractionDigits: 2,
                          signDisplay: "exceptZero",
                        })
                      : "—";
                  return (
                    <AccountRow
                      key={acc.id}
                      name={acc.name}
                      broker={acc.broker}
                      accountType={acc.account_type}
                      currency={acc.base_currency}
                      depositedLabel={depositedLabel}
                      equityLabel={equityLabel}
                      realizedPnlLabel={realizedPnlLabel}
                      pnlPctLabel={pnlPctLabel}
                      tradeCount={tradeCount}
                      netPnl={netPnl}
                      isPrimary={isPrimary}
                      headerAction={
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label={`Edit ${acc.name}`}
                          onClick={() => startEditAccount(acc)}
                          disabled={editingAccount}
                          className="h-8 border-border-strong bg-transparent px-3 text-[12px] text-text hover:bg-bg-hover"
                        >
                          Edit account
                        </Button>
                      }
                      footerActions={
                        <>
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
              </div>
            </div>
            <Modal
              open={Boolean(editAccountId)}
              onOpenChange={(open) => {
                if (!open) cancelEditAccount();
              }}
              title="Edit account"
              className="max-w-[min(500px,94vw)]"
              footer={
                <>
                  <BtnGhost onClick={cancelEditAccount} disabled={editingAccount} size="action">
                    <X size={12} strokeWidth={1.5} />
                    Cancel
                  </BtnGhost>
                  <BtnPrimary
                    onClick={() => {
                      if (editAccountId) void handleSaveAccount(editAccountId);
                    }}
                    disabled={editingAccount}
                    className="h-9 min-h-9"
                  >
                    <Check size={12} strokeWidth={1.5} />
                    {editingAccount ? "Saving…" : "Save"}
                  </BtnPrimary>
                </>
              }
            >
              <div className="flex flex-col gap-3">
                <SignalField label="Account name" htmlFor="edit-account-name">
                  <SignalInput
                    id="edit-account-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="e.g. Main Account"
                  />
                </SignalField>
                <SignalField label="Broker">
                  <NativeSelect
                    size="sm"
                    value={editBrokerChoice}
                    onChange={(e) => setEditBrokerChoice(e.target.value)}
                    aria-label="Broker"
                    className="h-8 w-full text-[12px]"
                    wrapperClassName="w-full"
                  >
                    {POPULAR_BROKERS.map((broker) => (
                      <NativeSelectOption key={broker} value={broker}>
                        {broker}
                      </NativeSelectOption>
                    ))}
                    <NativeSelectOption value={OTHER_BROKER_VALUE}>Other</NativeSelectOption>
                  </NativeSelect>
                </SignalField>
                {editBrokerChoice === OTHER_BROKER_VALUE ? (
                  <SignalField label="Custom broker" htmlFor="edit-account-broker">
                    <SignalInput
                      id="edit-account-broker"
                      value={editBrokerCustom}
                      onChange={(e) => setEditBrokerCustom(e.target.value)}
                      placeholder="Type broker name"
                    />
                  </SignalField>
                ) : null}
              </div>
              {accountEditError ? <FormError message={accountEditError} /> : null}
            </Modal>
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
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-sharp bg-bg-panel px-2 py-1 text-[11px] text-text-muted">
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
                      <NativeSelect
                        size="sm"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-label="Cash account"
                        className="h-8 w-full text-[12px]"
                        wrapperClassName="w-full"
                      >
                        {accounts.map((a) => (
                          <NativeSelectOption key={a.id} value={a.id}>
                            {a.name}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </SignalField>
                  )}
                </cashForm.Field>
                <cashForm.Field name="type">
                  {(field) => (
                    <SignalField label="Type">
                      <NativeSelect
                        size="sm"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-label="Cash type"
                        className="h-8 w-full text-[12px]"
                        wrapperClassName="w-full"
                      >
                        <NativeSelectOption value="deposit">Deposit</NativeSelectOption>
                        <NativeSelectOption value="withdrawal">Withdrawal</NativeSelectOption>
                        <NativeSelectOption value="fee">Fee</NativeSelectOption>
                        <NativeSelectOption value="dividend">Dividend</NativeSelectOption>
                        <NativeSelectOption value="interest">Interest</NativeSelectOption>
                        <NativeSelectOption value="adjustment">Adjustment</NativeSelectOption>
                      </NativeSelect>
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
          <SettingsPanelBody>
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} height="40px" />
              ))}
            </div>
          </SettingsPanelBody>
        ) : cashError ? (
          <SettingsPanelBody>
            <p className="text-[12px] text-loss">Failed to load transactions.</p>
          </SettingsPanelBody>
        ) : displayedTx.length === 0 ? (
          <SettingsPanelBody className="py-8">
            <EmptyState
              title={filterAccountId ? "No transactions for this account" : "No transactions yet"}
              hint={
                filterAccountId
                  ? "Record a deposit or withdrawal for this account."
                  : "Add a deposit or withdrawal to track balance changes."
              }
              icon={<Wallet size={28} strokeWidth={1.5} />}
            />
          </SettingsPanelBody>
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
                      {fmtDate(tx.occurred_at)}
                      {tx.note ? <span className="text-text-dim"> · {tx.note}</span> : null}
                    </>
                  }
                  actions={
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`mr-1.5 text-[12px] font-semibold tabular-nums ${
                          isOutflow ? "text-loss" : "text-profit"
                        }`}
                      >
                        {display}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        tooltip={false}
                        aria-label={`Edit ${tx.type} transaction`}
                        onClick={() => startEditCash(tx)}
                      >
                        <Pencil size={14} strokeWidth={1.5} />
                      </Button>
                      <DeleteButton label={tx.type} onDelete={() => void handleDeleteCash(tx.id)} />
                    </div>
                  }
                />
              );
            })}
          </SettingsGroup>
        )}
      </SettingsSection>

      <Modal
        open={Boolean(editCashId)}
        onOpenChange={(open) => {
          if (!open) cancelEditCash();
        }}
        title="Edit transaction"
        className="max-w-[min(440px,94vw)]"
        footer={
          <>
            <BtnGhost onClick={cancelEditCash} disabled={savingCash} size="action">
              <X size={12} strokeWidth={1.5} />
              Cancel
            </BtnGhost>
            <BtnPrimary onClick={() => void handleSaveCash()} disabled={savingCash}>
              <Check size={12} strokeWidth={1.5} />
              {savingCash ? "Saving…" : "Save"}
            </BtnPrimary>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <SignalField label="Type">
            <NativeSelect
              size="sm"
              value={editCashType}
              onChange={(e) => setEditCashType(e.target.value)}
              aria-label="Cash type"
              className="h-8 w-full text-[12px]"
              wrapperClassName="w-full"
            >
              <NativeSelectOption value="deposit">Deposit</NativeSelectOption>
              <NativeSelectOption value="withdrawal">Withdrawal</NativeSelectOption>
              <NativeSelectOption value="fee">Fee</NativeSelectOption>
              <NativeSelectOption value="dividend">Dividend</NativeSelectOption>
              <NativeSelectOption value="interest">Interest</NativeSelectOption>
              <NativeSelectOption value="adjustment">Adjustment</NativeSelectOption>
            </NativeSelect>
          </SignalField>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SignalField label="Amount" htmlFor="edit-cash-amount">
              <SignalAmountInput
                id="edit-cash-amount"
                value={editCashAmount}
                onValueChange={setEditCashAmount}
                placeholder="0.00"
              />
            </SignalField>
            <SignalField label="Date">
              <SignalDatePicker aria-label="Date" value={editCashDate} onChange={setEditCashDate} />
            </SignalField>
          </div>
          <SignalField label="Note" htmlFor="edit-cash-note">
            <SignalInput
              id="edit-cash-note"
              value={editCashNote}
              onChange={(e) => setEditCashNote(e.target.value)}
              placeholder="Optional note"
            />
          </SignalField>
          <FormError message={editCashError} />
        </div>
      </Modal>
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
          <SettingsPanelBody>
            <Skeleton height="120px" />
          </SettingsPanelBody>
        ) : riskRulesError ? (
          <SettingsPanelBody>
            <p className="text-[12px] text-loss">Failed to load risk rules.</p>
          </SettingsPanelBody>
        ) : (
          <SettingsPanelBody>
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                void riskForm.handleSubmit();
              }}
            >
              <div className="flex flex-wrap gap-3">
                <riskForm.Field
                  name="maxRisk"
                  validators={{
                    onBlur: ({ value }) => validateOptionalAmountField(value),
                  }}
                >
                  {(field) => (
                    <SignalField
                      className="min-w-[min(100%,14rem)] flex-1"
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
                        className="w-full"
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
                      className="min-w-[min(100%,14rem)] flex-1"
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
                        className="w-full"
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
                      className="min-w-[min(100%,14rem)] flex-1"
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
                        className="w-full"
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
                      className="min-w-[min(100%,14rem)] flex-1"
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
                        className="w-full"
                      />
                    </SignalField>
                  )}
                </riskForm.Field>
              </div>
              <riskForm.Subscribe selector={(s) => s.errorMap.onSubmit}>
                {(submitErr) => (
                  <FormError
                    message={riskFormError ?? (typeof submitErr === "string" ? submitErr : null)}
                  />
                )}
              </riskForm.Subscribe>
              <div className="flex items-center justify-end gap-3">
                <SavedBadge show={riskSaved} />
                <BtnPrimary type="submit" disabled={riskRulesSaving}>
                  <Shield size={12} strokeWidth={1.5} />
                  {riskRulesSaving ? "Saving…" : "Save rules"}
                </BtnPrimary>
              </div>
            </form>
          </SettingsPanelBody>
        )}
      </SettingsSection>

      <SettingsSection
        title="Daily Checklist"
        description="Pre-market / EOD checklist shown when you create a New Note. One item per line."
      >
        {checklistLoading ? (
          <SettingsPanelBody>
            <Skeleton height="100px" />
          </SettingsPanelBody>
        ) : checklistError ? (
          <SettingsPanelBody>
            <p className="text-[12px] text-loss">Failed to load checklist template.</p>
          </SettingsPanelBody>
        ) : (
          <SettingsPanelBody>
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
                      className="border border-border !bg-transparent hover:!bg-transparent focus-visible:!bg-transparent"
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
          </SettingsPanelBody>
        )}
      </SettingsSection>
    </>
  );
}

// ---------------------------------------------------------------------------
// Journal (tags)
// ---------------------------------------------------------------------------

export interface JournalTabProps {
  tags: TagType[];
  tagsLoading: boolean;
  tagsError: boolean;
  onCreateTag: (body: { name: string; color?: string; kind?: string }) => Promise<void>;
  onDeleteTag: (id: string) => Promise<void>;
}

export function JournalTab({
  tags,
  tagsLoading,
  tagsError,
  onCreateTag,
  onDeleteTag,
}: JournalTabProps) {
  const toast = useToastManager();
  const [showTagForm, setShowTagForm] = useState(false);
  const [tagFormError, setTagFormError] = useState<string | null>(null);

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
                      <NativeSelect
                        size="sm"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-label="Tag kind"
                        className="h-8 w-full text-[12px]"
                        wrapperClassName="w-full"
                      >
                        <NativeSelectOption value="custom">Custom</NativeSelectOption>
                        <NativeSelectOption value="mistake">Mistake</NativeSelectOption>
                      </NativeSelect>
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
          <SettingsPanelBody>
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} height="36px" />
              ))}
            </div>
          </SettingsPanelBody>
        ) : tagsError ? (
          <SettingsPanelBody>
            <p className="text-[12px] text-loss">Failed to load tags.</p>
          </SettingsPanelBody>
        ) : tags.length === 0 ? (
          <SettingsPanelBody className="py-8">
            <EmptyState
              title="No tags yet"
              hint="Create tags to annotate your trades."
              icon={<Tag size={28} strokeWidth={1.5} />}
            />
          </SettingsPanelBody>
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
        title="Playbook setups"
        description="Manage thesis, checklist, and performance on the Playbook page — not here."
      >
        <SettingsPanelBody>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="m-0 max-w-xl text-[12px] leading-relaxed text-text-muted">
              Setups are created and edited in Playbook, then linked when you log a trade.
            </p>
            <Button type="button" variant="outline" render={<a href="/playbook" />}>
              Open Playbook
            </Button>
          </div>
        </SettingsPanelBody>
      </SettingsSection>
    </>
  );
}

// ---------------------------------------------------------------------------
// AI & LLM
// ---------------------------------------------------------------------------

function llmApiLabels(locale: string, prefix: "vision" | "coach"): LlmApiSettingsLabels {
  const key = (suffix: string) => settingsLabel(locale, `${prefix}${suffix}` as SettingsLabelKey);
  return {
    enabled: key("Enabled"),
    enabledDetail: settingsLabel(locale, "llmEnabledDetail"),
    off: key("Off"),
    on: key("On"),
    baseUrl: key("BaseUrl"),
    baseUrlDetail: settingsLabel(locale, "llmBaseUrlDetail"),
    model: key("Model"),
    modelDetail: settingsLabel(locale, "llmModelDetail"),
    fetchModels: key("FetchModels"),
    fetchingModels: key("FetchingModels"),
    apiKey: key("ApiKey"),
    apiKeyHint: key("ApiKeyHint"),
    apiKeyDetail: settingsLabel(locale, "llmApiKeyDetail"),
    customPrompt: prefix === "coach" ? key("CustomPrompt") : key("CustomPrompt"),
    customPromptHint: key("CustomPromptHint"),
    save: key("Save"),
    test: key("Test"),
    testing: key("Testing"),
  };
}

function VisionScanSection() {
  const { locale } = useLocale();
  const { data, isPending, isError } = useOcrSettings();
  const save = useSaveOcrSettings();
  const test = useTestOcrSettings();
  const listModels = useListOcrModels();

  return (
    <SettingsSection
      title={settingsLabel(locale, "visionScan")}
      footer={settingsLabel(locale, "visionScanFooter")}
    >
      {isPending && !data ? (
        <SettingsPanelBody>
          <Skeleton height="160px" />
        </SettingsPanelBody>
      ) : isError || !data ? (
        <SettingsPanelBody>
          <p className="text-[12px] text-loss">Failed to load vision settings.</p>
        </SettingsPanelBody>
      ) : (
        <LlmApiSettingsForm
          settings={data}
          labels={llmApiLabels(locale, "vision")}
          saveErrorMessage="Could not save vision settings."
          onSave={(body) => save.mutateAsync(body)}
          onTest={(body) => test.mutateAsync(body)}
          onListModels={(body) => listModels.mutateAsync(body)}
        />
      )}
    </SettingsSection>
  );
}

function CoachSection() {
  const { locale } = useLocale();
  const { data, isPending, isError } = useCoachSettings();
  const save = useSaveCoachSettings();
  const test = useTestCoachSettings();
  const listModels = useListCoachModels();

  return (
    <SettingsSection
      title={settingsLabel(locale, "coachTitle")}
      footer={settingsLabel(locale, "coachFooter")}
    >
      {isPending && !data ? (
        <SettingsPanelBody>
          <Skeleton height="160px" />
        </SettingsPanelBody>
      ) : isError || !data ? (
        <SettingsPanelBody>
          <p className="text-[12px] text-loss">Failed to load coach settings.</p>
        </SettingsPanelBody>
      ) : (
        <LlmApiSettingsForm
          settings={data}
          labels={llmApiLabels(locale, "coach")}
          saveErrorMessage="Could not save coach settings."
          onSave={(body) => save.mutateAsync(body)}
          onTest={(body) => test.mutateAsync(body)}
          onListModels={(body) => listModels.mutateAsync(body)}
        />
      )}
    </SettingsSection>
  );
}

export function AiTab() {
  return (
    <>
      <VisionScanSection />
      <CoachSection />
    </>
  );
}

// ---------------------------------------------------------------------------
// General
// ---------------------------------------------------------------------------

export function GeneralTab() {
  const { locale, setLocale } = useLocale();
  const toast = useToastManager();
  const signOut = useAuth((s) => s.signOut);
  const maxScreenshots = useJournalPrefs((s) => s.maxScreenshotsPerTrade);
  const setMaxScreenshots = useJournalPrefs((s) => s.setMaxScreenshotsPerTrade);
  const timezone = useDisplayPrefs((s) => s.timezone);
  const setTimezone = useDisplayPrefs((s) => s.setTimezone);
  const timeFormat = useDisplayPrefs((s) => s.timeFormat);
  const setTimeFormat = useDisplayPrefs((s) => s.setTimeFormat);
  const tradeDateBasis = useDisplayPrefs((s) => s.tradeDateBasis);
  const setTradeDateBasis = useDisplayPrefs((s) => s.setTradeDateBasis);
  const [serverUrl, setServerUrl] = useState(() => editableApiBaseUrl(getCustomApiBaseUrl()));
  const configInputRef = useRef<HTMLInputElement | null>(null);

  function handleExportConfig() {
    const payload = buildAppConfigExport(locale, getCustomApiBaseUrl());
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const stamp = new Date().toISOString().slice(0, 10);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tradermemos-app-config-${stamp}.json`;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.add({
      title: "App config exported",
      description: "Downloaded your local app preferences as JSON.",
    });
  }

  async function handleImportConfig(file: File) {
    try {
      const parsed = parseAppConfig(await file.text());
      await applyParsedAppConfig(parsed, setLocale);
      setServerUrl(editableApiBaseUrl(getCustomApiBaseUrl()));
      toast.add({
        title: "App config imported",
        description: "Settings restored from backup.",
      });
    } catch (err) {
      toast.add({
        title: "Could not import config",
        description: err instanceof Error ? err.message : "Invalid config file.",
      });
    }
  }

  return (
    <>
      <SettingsSection>
        <SettingsGroup>
          <SettingsGroupRow
            label={settingsLabel(locale, "language")}
            detail={settingsLabel(locale, "languageFooter")}
          >
            <NativeSelect
              value={locale}
              onChange={(e) => {
                void setLocale(e.target.value as typeof locale);
              }}
              aria-label={settingsLabel(locale, "languageSelector")}
              className="w-full"
              wrapperClassName="w-full"
            >
              {LOCALE_OPTIONS.map((o) => (
                <NativeSelectOption key={o.value} value={o.value}>
                  {o.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </SettingsGroupRow>
          <SettingsGroupRow
            label={settingsLabel(locale, "timezone")}
            detail={settingsLabel(locale, "timezoneFooter")}
            alignTop
          >
            <NativeSelect
              value={timezone}
              onChange={(e) => setTimezone(e.target.value as TimezonePref)}
              aria-label={settingsLabel(locale, "timezoneSelector")}
              className="w-full"
              wrapperClassName="w-full"
            >
              {timezoneSelectOptions().map((o) => (
                <NativeSelectOption key={o.value} value={o.value}>
                  {o.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </SettingsGroupRow>
          <SettingsGroupRow
            label={settingsLabel(locale, "timeFormat")}
            detail={settingsLabel(locale, "timeFormatFooter")}
          >
            <NativeSelect
              value={timeFormat}
              onChange={(e) => setTimeFormat(e.target.value as TimeFormatPref)}
              aria-label={settingsLabel(locale, "timeFormatSelector")}
              className="w-full"
              wrapperClassName="w-full"
            >
              {TIME_FORMAT_OPTIONS.map((o) => (
                <NativeSelectOption key={o.value} value={o.value}>
                  {o.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </SettingsGroupRow>
          <SettingsGroupRow
            label={settingsLabel(locale, "tradeDateBasis")}
            detail={settingsLabel(locale, "tradeDateBasisFooter")}
          >
            <NativeSelect
              value={tradeDateBasis}
              onChange={(e) => setTradeDateBasis(e.target.value as TradeDateBasis)}
              aria-label={settingsLabel(locale, "tradeDateBasisSelector")}
              className="w-full"
              wrapperClassName="w-full"
            >
              {TRADE_DATE_BASIS_OPTIONS.map((o) => (
                <NativeSelectOption key={o.value} value={o.value}>
                  {o.value === "close"
                    ? settingsLabel(locale, "tradeDateBasisClose")
                    : settingsLabel(locale, "tradeDateBasisOpen")}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </SettingsGroupRow>
          <SettingsGroupRow
            label={settingsLabel(locale, "maxScreenshots")}
            detail={settingsLabel(locale, "screenshotsFooter")}
          >
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
              className="h-10 w-full text-[13px]"
            />
          </SettingsGroupRow>
          <SettingsGroupRow
            label={settingsLabel(locale, "serverUrl")}
            detail={settingsLabel(locale, "serverUrlFooter")}
            alignTop
          >
            <SignalInput
              type="text"
              inputMode="url"
              spellCheck={false}
              placeholder={settingsLabel(locale, "serverUrlHint")}
              aria-label={settingsLabel(locale, "serverUrl")}
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              onBlur={() => {
                setBaseUrl(serverUrl);
                setServerUrl(editableApiBaseUrl(getCustomApiBaseUrl()));
              }}
              className="h-10 w-full text-[13px]"
            />
          </SettingsGroupRow>
          <SettingsGroupRow
            label={settingsLabel(locale, "session")}
            detail={settingsLabel(locale, "signOutFooter")}
          >
            <Button type="button" variant="outline" onClick={() => signOut()}>
              {settingsLabel(locale, "signOut")}
            </Button>
          </SettingsGroupRow>
          <SettingsGroupRow
            label={settingsLabel(locale, "appConfig")}
            detail={settingsLabel(locale, "appConfigFooter")}
            last
          >
            <div className="flex w-full flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={handleExportConfig}>
                <Download size={13} strokeWidth={1.5} />
                {settingsLabel(locale, "exportConfig")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => configInputRef.current?.click()}
              >
                <Upload size={13} strokeWidth={1.5} />
                {settingsLabel(locale, "importConfig")}
              </Button>
              <input
                ref={configInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleImportConfig(file);
                  event.currentTarget.value = "";
                }}
              />
            </div>
          </SettingsGroupRow>
        </SettingsGroup>
      </SettingsSection>
    </>
  );
}
