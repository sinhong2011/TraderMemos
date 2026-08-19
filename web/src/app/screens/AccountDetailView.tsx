import { Link } from "@tanstack/react-router";
import { ArrowLeft, Pencil, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { FlexSyncButton } from "@/components/FlexSyncModal";
import { Field } from "@/components/Field";
import { FormInput } from "@/components/FormInput";
import { Modal } from "@/components/Modal";
import { Page } from "@/components/Page";
import { Pill } from "@/components/Pill";
import { PropRulesButton } from "@/components/PropRulesModal";
import { useToastManager } from "@/components/Toast";
import { Badge } from "@/components/reui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { flexSyncFailed } from "@/lib/api/flexSync";
import type { Account } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { usePrivacyMode } from "@/lib/displayPrefs";
import { fmtMoney, fmtSignedMoney } from "@/lib/format";
import {
  useAccounts,
  useClearAccountTrades,
  useDeleteAccount,
  useUpdateAccount,
} from "@/lib/hooks/useAccounts";
import { useCash } from "@/lib/hooks/useCash";
import { useFlexSync, useRunFlexSync } from "@/lib/hooks/useFlexSync";
import { useTrades } from "@/lib/hooks/useTrades";
import { intlLocale } from "@/lib/locale";
import { ClearTradesButton, DeleteAccountButton } from "@/app/screens/settings/settings-ui";
import { ImportHistorySection } from "@/app/screens/settings/import-history";
import {
  ledgerBalance,
  OTHER_BROKER_VALUE,
  POPULAR_BROKERS,
  primaryAccountId,
} from "@/app/screens/settings/settings-sections";

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="min-w-0">
      <p className="m-0 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "m-0 mt-1 text-[16px] font-semibold tabular-nums tracking-tight text-foreground",
          className,
        )}
      >
        {value}
      </p>
    </div>
  );
}

function EditAccountButton({ account }: { account: Account }) {
  const [open, setOpen] = useState(false);
  const toast = useToastManager();
  const update = useUpdateAccount();
  const knownBroker = (POPULAR_BROKERS as readonly string[]).includes(account.broker);
  const [name, setName] = useState(account.name);
  const [brokerChoice, setBrokerChoice] = useState(
    knownBroker ? account.broker : OTHER_BROKER_VALUE,
  );
  const [brokerCustom, setBrokerCustom] = useState(knownBroker ? "" : account.broker);
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    const broker = brokerChoice === OTHER_BROKER_VALUE ? brokerCustom.trim() : brokerChoice;
    if (!name.trim()) {
      setError("Name the account first.");
      return;
    }
    update.mutate(
      { id: account.id, body: { name: name.trim(), broker } },
      {
        onSuccess: () => {
          setOpen(false);
          setError(null);
          toast.add({ title: "Account updated", description: name.trim() });
        },
        onError: () => setError("Could not save the account. Try again."),
      },
    );
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil size={13} strokeWidth={1.5} />
        Edit
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={`Edit ${account.name}`}
        className="max-w-[min(440px,94vw)]"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label="Name" htmlFor="account-detail-name">
            <FormInput
              id="account-detail-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Broker" htmlFor="account-detail-broker">
            <NativeSelect
              id="account-detail-broker"
              value={brokerChoice}
              onChange={(e) => setBrokerChoice(e.target.value)}
              wrapperClassName="w-full"
            >
              {POPULAR_BROKERS.map((b) => (
                <NativeSelectOption key={b} value={b}>
                  {b}
                </NativeSelectOption>
              ))}
              <NativeSelectOption value={OTHER_BROKER_VALUE}>Other…</NativeSelectOption>
            </NativeSelect>
          </Field>
          {brokerChoice === OTHER_BROKER_VALUE ? (
            <Field label="Broker name" htmlFor="account-detail-broker-custom">
              <FormInput
                id="account-detail-broker-custom"
                value={brokerCustom}
                onChange={(e) => setBrokerCustom(e.target.value)}
                placeholder="My broker"
              />
            </Field>
          ) : null}
          {error ? <p className="m-0 text-[12px] text-destructive">{error}</p> : null}
        </div>
      </Modal>
    </>
  );
}

function ConnectionCard({ account }: { account: Account }) {
  const toast = useToastManager();
  const settingsQ = useFlexSync(account.id);
  const run = useRunFlexSync(account.id);
  const s = settingsQ.data;

  function handleRun() {
    run.mutate(undefined, {
      onSuccess: (res) =>
        toast.add({
          title: "Sync complete",
          description: `${res.inserted} new execution${res.inserted === 1 ? "" : "s"}, ${res.skipped} duplicate${res.skipped === 1 ? "" : "s"}`,
        }),
      onError: (err) =>
        toast.add({
          title: "Sync failed",
          description: err instanceof Error ? err.message : "Sync failed",
        }),
    });
  }

  return (
    <Card
      title="Broker connection"
      description="Pulls new fills into this account automatically."
      action={
        s?.configured ? (
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRun}
              disabled={run.isPending}
            >
              <RefreshCw
                size={13}
                strokeWidth={1.5}
                className={run.isPending ? "animate-spin" : ""}
              />
              {run.isPending ? "Syncing…" : "Sync now"}
            </Button>
            <FlexSyncButton accountId={account.id} accountName={account.name} label="Configure" />
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            render={
              <Link to="/connect" search={{ account: account.id }} className="no-underline" />
            }
          >
            Connect broker
          </Button>
        )
      }
    >
      {s?.configured ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-medium">Interactive Brokers · Flex sync</span>
            <Badge
              variant={
                flexSyncFailed(s) ? "destructive-light" : s.enabled ? "success-light" : "secondary"
              }
            >
              {flexSyncFailed(s) ? "Sync failing" : s.enabled ? "Healthy" : "Manual only"}
            </Badge>
          </div>
          <p className="m-0 text-[12px] text-muted-foreground">
            {s.last_synced_at
              ? `Last sync ${new Date(s.last_synced_at).toLocaleString()} — ${s.last_status || "done"}`
              : "Never synced yet."}
          </p>
          {s.last_error ? <p className="m-0 text-[12px] text-destructive">{s.last_error}</p> : null}
        </div>
      ) : (
        <p className="m-0 text-[13px] text-muted-foreground">
          No broker connected. Connect Interactive Brokers to sync fills on a schedule, or import
          statements by file.
        </p>
      )}
    </Card>
  );
}

export function AccountDetailView({
  accountId,
  onBack,
  onDeleted,
}: {
  accountId: string;
  onBack: () => void;
  onDeleted: () => void;
}) {
  usePrivacyMode();
  const toast = useToastManager();
  const accountsQ = useAccounts();
  const accounts = accountsQ.data ?? [];
  const account = accounts.find((a) => a.id === accountId);
  const tradesQ = useTrades({ account_id: accountId });
  const cashQ = useCash({ account_id: accountId });
  const deleteAccount = useDeleteAccount();
  const clearTrades = useClearAccountTrades();

  if (accountsQ.isLoading) return <Page>{null}</Page>;
  if (!account) {
    return (
      <Page>
        <EmptyState
          title="Account not found"
          hint="It may have been deleted."
          actions={
            <Button type="button" variant="outline" size="sm" onClick={onBack}>
              <ArrowLeft size={13} strokeWidth={1.5} />
              All accounts
            </Button>
          }
        />
      </Page>
    );
  }

  const trades = tradesQ.data ?? [];
  const netPnl = trades.reduce((sum, t) => sum + (t.net_pnl ?? 0), 0);
  const tradeCount = trades.length;
  const balance = ledgerBalance(account, cashQ.data ?? []);
  const equity = balance + netPnl;
  const locale = intlLocale();
  const isPrimary = account.id === primaryAccountId(accounts);
  const isOnlyAccount = accounts.length === 1;
  const pnlPct =
    balance !== 0
      ? (netPnl / balance).toLocaleString(locale, {
          style: "percent",
          maximumFractionDigits: 2,
          signDisplay: "exceptZero",
        })
      : null;
  const metaParts = [
    account.broker || null,
    account.account_type
      ? account.account_type.charAt(0).toUpperCase() + account.account_type.slice(1)
      : null,
    account.base_currency || null,
    tradeCount > 0 ? `${tradeCount} ${tradeCount === 1 ? "trade" : "trades"}` : null,
  ].filter(Boolean);

  return (
    <Page className="gap-4">
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="m-0 truncate text-[22px] font-semibold tracking-tight text-foreground">
              {account.name}
            </h1>
            {isPrimary ? <Pill tone="amber">Primary</Pill> : null}
          </div>
          <p className="m-0 mt-1 text-[12px] text-muted-foreground">{metaParts.join(" · ")}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button type="button" variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft size={13} strokeWidth={1.5} />
            All accounts
          </Button>
          {account.account_type === "prop" ? (
            <PropRulesButton accountId={account.id} accountName={account.name} />
          ) : null}
          <EditAccountButton account={account} />
        </div>
      </header>

      <Card>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
          <Stat label="Deposited" value={fmtMoney(balance, account.base_currency, locale)} />
          <Stat label="Equity" value={fmtMoney(equity, account.base_currency, locale)} />
          <Stat
            label="Realized P&L"
            value={`${fmtSignedMoney(netPnl, account.base_currency, locale)}${pnlPct ? ` (${pnlPct})` : ""}`}
            className={
              netPnl > 0 ? "text-profit" : netPnl < 0 ? "text-destructive" : "text-muted-foreground"
            }
          />
        </div>
      </Card>

      <ConnectionCard account={account} />

      <ImportHistorySection accounts={accounts} accountId={account.id} />

      <Card title="Danger zone" description="Both actions ask before doing anything.">
        <div className="flex flex-col divide-y divide-border/40">
          <div className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0 flex-1">
              <p className="m-0 text-[13px] font-medium text-foreground">Clear trade history</p>
              <p className="m-0 mt-0.5 text-[12px] text-muted-foreground">
                {tradeCount > 0
                  ? `Deletes the ${tradeCount} trade${tradeCount === 1 ? "" : "s"} and every execution in this account.`
                  : "Deletes every trade and execution in this account."}
              </p>
            </div>
            <ClearTradesButton
              accountName={account.name}
              tradeCount={tradeCount}
              onClear={async () => {
                try {
                  await clearTrades.mutateAsync(account.id);
                  toast.add({ title: "Trades cleared", description: account.name });
                } catch {
                  toast.add({ title: "Could not clear trades", description: "Try again." });
                }
              }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0 flex-1">
              <p className="m-0 text-[13px] font-medium text-foreground">Delete account</p>
              <p className="m-0 mt-0.5 text-[12px] text-muted-foreground">
                {isOnlyAccount
                  ? "Add another account before deleting this one."
                  : "Removes the account with its trades, cash transactions and attachments."}
              </p>
            </div>
            <DeleteAccountButton
              accountName={account.name}
              label="Delete account"
              onDelete={async () => {
                try {
                  await deleteAccount.mutateAsync(account.id);
                  toast.add({ title: "Account deleted", description: account.name });
                  onDeleted();
                } catch {
                  toast.add({ title: "Could not delete account", description: "Try again." });
                }
              }}
              disabled={isOnlyAccount}
              disabledReason="Add another account before deleting this one"
            />
          </div>
        </div>
      </Card>
    </Page>
  );
}
