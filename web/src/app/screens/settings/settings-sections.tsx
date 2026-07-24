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
import { ModeToggle } from "../../../components/ModeToggle";
import { Modal } from "../../../components/Modal";
import { SignalAmountInput } from "../../../components/SignalAmountInput";
import { SignalDatePicker } from "../../../components/SignalDatePicker";
import { SignalEditor } from "../../../components/SignalEditor";
import { fieldError, SignalField } from "../../../components/SignalField";
import { SignalInput } from "../../../components/SignalInput";
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
  activeRiskRuleEntries,
  availableRiskRuleKeys,
  defaultAccountFormValues,
  defaultCashFormValues,
  defaultTagFormValues,
  formatRiskRuleValue,
  parseRiskRuleValue,
  riskRuleDef,
  setRiskRuleValue,
  validateAccountId,
  validatePositiveAmount,
  validateRequiredName,
  validateRiskRuleValue,
  validateStartingBalance,
  type RiskRuleKey,
} from "../../../lib/settingsFormSchema";
import {
  AccountRow,
  BtnGhost,
  BtnPrimary,
  ClearTradesButton,
  DeleteAccountButton,
  DeleteButton,
  FormError,
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
  "FUTU NIU NIU",
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
  const trades = tradesQ.data;
  const primaryId = useMemo(() => primaryAccountId(accounts), [accounts]);
  const tradeCountByAccount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const trade of trades ?? []) {
      counts.set(trade.account_id, (counts.get(trade.account_id) ?? 0) + 1);
    }
    return counts;
  }, [trades]);
  const netPnlByAccount = useMemo(() => {
    const totals = new Map<string, number>();
    for (const trade of trades ?? []) {
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
          <BtnGhost
            onClick={() => {
              setAccountFormError(null);
              accountForm.reset({
                ...defaultAccountFormValues(),
                broker: POPULAR_BROKERS[0],
              });
              setShowAccountForm(true);
            }}
          >
            <Plus size={13} strokeWidth={1.5} />
            Add account
          </BtnGhost>
        }
      >
        <Modal
          open={showAccountForm}
          onOpenChange={(open) => {
            if (!open) {
              setShowAccountForm(false);
              setAccountFormError(null);
              accountForm.reset(defaultAccountFormValues());
            }
          }}
          title="Add account"
          className="max-w-[min(500px,94vw)]"
          footer={
            <accountForm.Subscribe selector={(s) => s.isSubmitting}>
              {(accountSaving) => (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowAccountForm(false);
                      setAccountFormError(null);
                      accountForm.reset(defaultAccountFormValues());
                    }}
                    disabled={accountSaving}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void accountForm.handleSubmit()}
                    disabled={accountSaving}
                  >
                    {accountSaving ? "Creating…" : "Create"}
                  </Button>
                </>
              )}
            </accountForm.Subscribe>
          }
        >
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void accountForm.handleSubmit();
            }}
          >
            <accountForm.Field
              name="name"
              validators={{
                onBlur: ({ value }) => validateRequiredName(value),
                onSubmit: ({ value }) => validateRequiredName(value),
              }}
            >
              {(field) => (
                <SignalField
                  label="Account name"
                  htmlFor="acct-name"
                  error={fieldError(field.state.meta.errors)}
                >
                  <SignalInput
                    id="acct-name"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="e.g. Main Account"
                    autoFocus
                  />
                </SignalField>
              )}
            </accountForm.Field>
            <accountForm.Field
              name="broker"
              validators={{
                onBlur: ({ value }) => (value.trim() ? undefined : "Broker is required."),
                onSubmit: ({ value }) => (value.trim() ? undefined : "Broker is required."),
              }}
            >
              {(field) => {
                const brokerIsOther = !(POPULAR_BROKERS as readonly string[]).includes(
                  field.state.value,
                );
                const brokerSelectValue = brokerIsOther ? OTHER_BROKER_VALUE : field.state.value;
                return (
                  <>
                    <SignalField
                      label="Broker"
                      error={brokerIsOther ? undefined : fieldError(field.state.meta.errors)}
                    >
                      <NativeSelect
                        id="acct-broker"
                        value={brokerSelectValue}
                        onChange={(e) => {
                          const next = e.target.value;
                          field.handleChange(next === OTHER_BROKER_VALUE ? "" : next);
                        }}
                        onBlur={field.handleBlur}
                        aria-label="Broker"
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
                    {brokerSelectValue === OTHER_BROKER_VALUE ? (
                      <SignalField
                        label="Custom broker"
                        htmlFor="acct-broker-other"
                        error={fieldError(field.state.meta.errors)}
                      >
                        <SignalInput
                          id="acct-broker-other"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="Type broker name"
                          autoFocus
                        />
                      </SignalField>
                    ) : null}
                  </>
                );
              }}
            </accountForm.Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <accountForm.Field name="accountType">
                {(field) => (
                  <SignalField label="Account type">
                    <NativeSelect
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-label="Account type"
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
          </form>
        </Modal>

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
            <p className="text-[12px] text-destructive">Failed to load accounts.</p>
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
                <p className="text-[11px] text-destructive">{accountDeleteError}</p>
              ) : null}
              {accountEditError ? (
                <p className="text-[11px] text-destructive">{accountEditError}</p>
              ) : null}
              {clearTradesError ? (
                <p className="text-[11px] text-destructive">{clearTradesError}</p>
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
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            aria-label={`Edit ${acc.name}`}
                            title="Edit account"
                            onClick={() => startEditAccount(acc)}
                            disabled={editingAccount}
                            className="border-border bg-transparent text-foreground hover:bg-accent"
                          >
                            <Pencil size={14} strokeWidth={1.5} />
                          </Button>
                          <DeleteAccountButton
                            accountName={acc.name}
                            detail={accountRecordDetail(tradeCount, cashCount)}
                            onDelete={() => void handleDeleteAccount(acc.id)}
                            disabled={isOnlyAccount}
                            disabledReason="Add another account before deleting this one"
                          />
                        </div>
                      }
                      footerActions={
                        <ClearTradesButton
                          accountName={acc.name}
                          tradeCount={tradeCount}
                          onClear={() => void handleClearAccountTrades(acc.id)}
                        />
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
                  <Button
                    type="button"
                    variant="outline"
                    onClick={cancelEditAccount}
                    disabled={editingAccount}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      if (editAccountId) void handleSaveAccount(editAccountId);
                    }}
                    disabled={editingAccount}
                  >
                    {editingAccount ? "Saving…" : "Save"}
                  </Button>
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
                    value={editBrokerChoice}
                    onChange={(e) => setEditBrokerChoice(e.target.value)}
                    aria-label="Broker"
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
            <span className="rounded-md bg-card px-2 py-1 text-[11px] text-muted-foreground">
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
            <p className="text-[12px] text-destructive">Failed to load transactions.</p>
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
                        <span className="ml-2 font-normal text-muted-foreground">
                          · {acct.name}
                        </span>
                      )}
                    </span>
                  }
                  secondary={
                    <>
                      {fmtDate(tx.occurred_at)}
                      {tx.note ? <span className="text-muted-foreground"> · {tx.note}</span> : null}
                    </>
                  }
                  actions={
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`mr-1.5 text-[12px] font-semibold tabular-nums ${
                          isOutflow ? "text-destructive" : "text-profit"
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
            <Button type="button" variant="outline" onClick={cancelEditCash} disabled={savingCash}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSaveCash()} disabled={savingCash}>
              {savingCash ? "Saving…" : "Save"}
            </Button>
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
  checklistContent: string;
  checklistLoading: boolean;
  checklistError: boolean;
  checklistSaving: boolean;
  onSaveChecklist: (body: { items?: string[]; content: string }) => Promise<void>;
}

type RuleModalState =
  | { open: false }
  | { open: true; mode: "add" }
  | { open: true; mode: "edit"; key: RiskRuleKey };

export function RulesTab({
  riskRules,
  riskRulesLoading,
  riskRulesError,
  riskRulesSaving,
  onSaveRiskRules,
  checklistItems,
  checklistContent,
  checklistLoading,
  checklistError,
  checklistSaving,
  onSaveChecklist,
}: RulesTabProps) {
  const toast = useToastManager();
  const locale = intlLocale();
  const [ruleModal, setRuleModal] = useState<RuleModalState>({ open: false });
  const [ruleKey, setRuleKey] = useState<RiskRuleKey>("max_risk_per_trade");
  const [ruleValue, setRuleValue] = useState("");
  const [ruleError, setRuleError] = useState<string | null>(null);

  const [checklistDraft, setChecklistDraft] = useState(checklistContent);
  const [checklistEditorKey, setChecklistEditorKey] = useState(0);
  const [checklistModalOpen, setChecklistModalOpen] = useState(false);

  useEffect(() => {
    if (checklistModalOpen) return;
    setChecklistDraft(checklistContent);
    setChecklistEditorKey((k) => k + 1);
  }, [checklistContent, checklistModalOpen]);

  const activeRules = useMemo(() => activeRiskRuleEntries(riskRules), [riskRules]);
  const availableKeys = useMemo(() => availableRiskRuleKeys(riskRules), [riskRules]);
  const canAddRule = availableKeys.length > 0;

  function closeRuleModal() {
    setRuleModal({ open: false });
    setRuleError(null);
    setRuleValue("");
  }

  function openChecklistModal() {
    setChecklistDraft(checklistContent);
    setChecklistEditorKey((k) => k + 1);
    setChecklistModalOpen(true);
  }

  function closeChecklistModal() {
    if (checklistSaving) return;
    setChecklistModalOpen(false);
    setChecklistDraft(checklistContent);
    setChecklistEditorKey((k) => k + 1);
  }

  function openAddRule() {
    const first = availableKeys[0];
    if (!first) return;
    setRuleKey(first);
    setRuleValue("");
    setRuleError(null);
    setRuleModal({ open: true, mode: "add" });
  }

  function openEditRule(key: RiskRuleKey, value: number) {
    setRuleKey(key);
    setRuleValue(String(value));
    setRuleError(null);
    setRuleModal({ open: true, mode: "edit", key });
  }

  async function persistRules(next: RiskRules, successTitle: string) {
    try {
      await onSaveRiskRules(next);
      toast.add({ title: successTitle });
      closeRuleModal();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed";
      setRuleError(message);
      toast.add({ title: "Could not save risk rule", description: message });
    }
  }

  async function handleSaveRule() {
    const key = ruleModal.open && ruleModal.mode === "edit" ? ruleModal.key : ruleKey;
    const validation = validateRiskRuleValue(key, ruleValue);
    if (validation) {
      setRuleError(validation);
      return;
    }
    const parsed = parseRiskRuleValue(key, ruleValue);
    if (parsed == null) {
      setRuleError("Enter a valid number.");
      return;
    }
    setRuleError(null);
    await persistRules(
      setRiskRuleValue(riskRules, key, parsed),
      ruleModal.open && ruleModal.mode === "edit" ? "Rule updated" : "Rule added",
    );
  }

  async function handleDeleteRule(key: RiskRuleKey) {
    try {
      await onSaveRiskRules(setRiskRuleValue(riskRules, key, null));
      toast.add({ title: "Rule removed", description: riskRuleDef(key).label });
    } catch (err) {
      toast.add({
        title: "Could not remove rule",
        description: err instanceof Error ? err.message : "Request failed",
      });
    }
  }

  async function handleSaveChecklist() {
    try {
      await onSaveChecklist({ content: checklistDraft });
      toast.add({ title: "Checklist saved" });
      setChecklistModalOpen(false);
    } catch (err) {
      toast.add({
        title: "Could not save checklist",
        description: err instanceof Error ? err.message : "Request failed",
      });
    }
  }

  const modalDef = riskRuleDef(ruleKey);
  const modalTitle =
    ruleModal.open && ruleModal.mode === "edit" ? "Edit risk rule" : "Add risk rule";

  return (
    <>
      <SettingsSection
        title="Risk Rules"
        description="Used by Check compliance on New Trade. Add only the limits you want enforced."
        action={
          <BtnGhost
            onClick={openAddRule}
            disabled={!canAddRule || riskRulesLoading || riskRulesSaving}
          >
            <Plus size={13} strokeWidth={1.5} />
            Add rule
          </BtnGhost>
        }
      >
        {riskRulesLoading ? (
          <SettingsPanelBody>
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} height="52px" />
              ))}
            </div>
          </SettingsPanelBody>
        ) : riskRulesError ? (
          <SettingsPanelBody>
            <p className="text-[12px] text-destructive">Failed to load risk rules.</p>
          </SettingsPanelBody>
        ) : activeRules.length === 0 ? (
          <SettingsPanelBody className="py-8">
            <EmptyState
              title="No risk rules yet"
              hint="Add a limit — max risk per trade, daily loss, open risk, or account risk %."
              icon={<Shield size={28} strokeWidth={1.5} />}
            />
          </SettingsPanelBody>
        ) : (
          <SettingsGroup>
            {activeRules.map(({ key, value, def }, index) => (
              <SettingsRow
                key={key}
                last={index === activeRules.length - 1}
                primary={def.label}
                secondary={def.detail}
                actions={
                  <>
                    <span className="text-[13px] font-medium tabular-nums text-foreground">
                      {formatRiskRuleValue(key, value, locale)}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={`Edit ${def.label}`}
                      disabled={riskRulesSaving}
                      onClick={() => openEditRule(key, value)}
                    >
                      Edit
                    </Button>
                    <DeleteButton
                      label={def.label}
                      disabled={riskRulesSaving}
                      onDelete={() => void handleDeleteRule(key)}
                    />
                  </>
                }
              />
            ))}
          </SettingsGroup>
        )}
      </SettingsSection>

      <SettingsSection
        title="Daily Checklist"
        description="Trading rules and checklist items for New Note. Edit in a modal — task items appear when you create a daily log."
        action={
          <BtnGhost
            onClick={openChecklistModal}
            disabled={checklistLoading || checklistError}
            aria-label="Edit checklist"
          >
            <Pencil size={13} strokeWidth={1.5} />
            Edit
          </BtnGhost>
        }
      >
        {checklistLoading ? (
          <SettingsPanelBody>
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} height="40px" />
              ))}
            </div>
          </SettingsPanelBody>
        ) : checklistError ? (
          <SettingsPanelBody>
            <p className="text-[12px] text-destructive">Failed to load checklist template.</p>
          </SettingsPanelBody>
        ) : checklistItems.length === 0 && !checklistContent.trim() ? (
          <SettingsPanelBody className="py-8">
            <EmptyState
              title="No checklist yet"
              hint="Add rules and - [ ] items. They show up on New Note."
              icon={<Check size={28} strokeWidth={1.5} />}
            />
          </SettingsPanelBody>
        ) : checklistItems.length > 0 ? (
          <SettingsGroup>
            {checklistItems.map((item, index) => (
              <SettingsRow
                key={`${item}-${index}`}
                last={index === checklistItems.length - 1}
                primary={item}
              />
            ))}
          </SettingsGroup>
        ) : (
          <SettingsPanelBody>
            <p className="text-[12px] text-muted-foreground">
              Checklist text saved — add <code className="text-primary">- [ ]</code> items so they
              appear on New Note.
            </p>
          </SettingsPanelBody>
        )}
      </SettingsSection>

      <Modal
        open={checklistModalOpen}
        onOpenChange={(open) => {
          if (!open) closeChecklistModal();
        }}
        title="Daily checklist"
        className="max-w-[min(560px,94vw)]"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={closeChecklistModal}
              disabled={checklistSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleSaveChecklist()}
              disabled={checklistSaving}
            >
              {checklistSaving ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <SignalEditor
            key={checklistEditorKey}
            value={checklistDraft}
            onChange={setChecklistDraft}
            placeholder={"- [ ] Check VIX\n- [ ] No revenge trades\n- [ ] Size within risk rules"}
            minHeight={220}
            showHints
            aria-label="Daily checklist and rules"
          />
          <p className="text-[11px] text-muted-foreground">
            Tip: use checklist buttons or type <code className="text-primary">- [ ]</code> for each
            rule.
          </p>
        </div>
      </Modal>

      <Modal
        open={ruleModal.open}
        onOpenChange={(open) => {
          if (!open) closeRuleModal();
        }}
        title={modalTitle}
        className="max-w-[min(440px,94vw)]"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={closeRuleModal}
              disabled={riskRulesSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                riskRulesSaving || (ruleModal.open && ruleModal.mode === "add" && !canAddRule)
              }
              onClick={() => void handleSaveRule()}
            >
              {riskRulesSaving
                ? "Saving…"
                : ruleModal.open && ruleModal.mode === "edit"
                  ? "Save"
                  : "Add rule"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {ruleModal.open && ruleModal.mode === "add" ? (
            <SignalField label="Rule type">
              <NativeSelect
                size="sm"
                value={ruleKey}
                onChange={(e) => setRuleKey(e.target.value as RiskRuleKey)}
                aria-label="Rule type"
                className="h-8 w-full text-[12px]"
                wrapperClassName="w-full"
              >
                {availableKeys.map((key) => {
                  const def = riskRuleDef(key);
                  return (
                    <NativeSelectOption key={key} value={key}>
                      {def.label}
                    </NativeSelectOption>
                  );
                })}
              </NativeSelect>
            </SignalField>
          ) : (
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                Rule type
              </span>
              <p className="m-0 text-[13px] font-medium text-foreground">{modalDef.label}</p>
              <p className="m-0 text-[12px] text-muted-foreground">{modalDef.detail}</p>
            </div>
          )}
          <SignalField
            label={modalDef.unit === "%" ? "Value (%)" : "Value ($)"}
            htmlFor="risk-rule-value"
            error={ruleError ?? undefined}
          >
            <SignalAmountInput
              id="risk-rule-value"
              value={ruleValue}
              onValueChange={(v) => {
                setRuleValue(v);
                if (ruleError) setRuleError(null);
              }}
              placeholder={modalDef.placeholder}
              aria-label={modalDef.label}
              className="w-full"
            />
          </SignalField>
        </div>
      </Modal>
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
                        className="h-8 w-full cursor-pointer rounded-md border-none bg-muted p-0.5"
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
            <p className="text-[12px] text-destructive">Failed to load tags.</p>
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
            <p className="m-0 max-w-xl text-[12px] leading-relaxed text-muted-foreground">
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
          <p className="text-[12px] text-destructive">Failed to load vision settings.</p>
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
          <p className="text-[12px] text-destructive">Failed to load coach settings.</p>
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
            label={settingsLabel(locale, "theme")}
            detail={settingsLabel(locale, "themeFooter")}
          >
            <ModeToggle
              labels={{
                themeLight: settingsLabel(locale, "themeLight"),
                themeDark: settingsLabel(locale, "themeDark"),
                themeSystem: settingsLabel(locale, "themeSystem"),
                themeSelector: settingsLabel(locale, "themeSelector"),
              }}
              className="w-full"
              wrapperClassName="w-full"
            />
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
