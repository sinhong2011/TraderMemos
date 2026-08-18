import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, PenLine, RefreshCw, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { AmountInput } from "@/components/AmountInput";
import { BrokerMark } from "@/components/BrokerMark";
import { BrokerPicker } from "@/components/BrokerPicker";
import { BrokerSteps } from "@/components/BrokerSteps";
import { Card } from "@/components/Card";
import { Field } from "@/components/Field";
import { FormInput, PasswordInput } from "@/components/FormInput";
import { Page } from "@/components/Page";
import { Pill } from "@/components/Pill";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Skeleton } from "@/components/Skeleton";
import { useToastManager } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { flexSyncApi, flexSyncFailed } from "@/lib/api/flexSync";
import { useFlexSync } from "@/lib/hooks/useFlexSync";
import { Badge } from "@/components/reui/badge";
import type { Account } from "@/lib/api/types";
import { type BrokerConnectKind, type BrokerDef, findBroker, KIND_LABEL } from "@/lib/brokers";
import { useAccounts, useCreateAccount } from "@/lib/hooks/useAccounts";

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** The steps card answers a different question per connection kind. */
const STEPS_TITLE: Record<BrokerConnectKind, (broker: BrokerDef) => string> = {
  sync: () => "Where to find these",
  file: (broker) => `Export from ${broker.name}`,
  manual: () => "How this works",
};

// ---------------------------------------------------------------------------
// Account — pick an existing one, or create the account this connection feeds
// ---------------------------------------------------------------------------

interface AccountChoice {
  mode: "existing" | "new";
  existingId: string;
  name: string;
  currency: string;
  accountType: string;
  startingBalance: string;
}

function initialChoice(
  broker: BrokerDef,
  accounts: Account[],
  preferredId?: string,
): AccountChoice {
  const preferred =
    accounts.find((a) => a.id === preferredId)?.id ??
    accounts.find((a) => a.broker === broker.accountBroker)?.id ??
    accounts[0]?.id ??
    "";
  return {
    mode: accounts.length > 0 ? "existing" : "new",
    existingId: preferred,
    name: broker.kind === "manual" ? "" : broker.name,
    currency: "USD",
    accountType: "cash",
    startingBalance: "",
  };
}

function AccountPanel({
  choice,
  onChange,
  accounts,
  loading,
  busy,
}: {
  choice: AccountChoice;
  onChange: (next: AccountChoice) => void;
  accounts: Account[];
  loading: boolean;
  busy: boolean;
}) {
  const set = (patch: Partial<AccountChoice>) => onChange({ ...choice, ...patch });

  return (
    <Card
      title="Account"
      description="Where these trades land. One account per broker account keeps balances and filters honest."
    >
      {loading ? (
        <Skeleton height="36px" />
      ) : (
        <div className="flex flex-col gap-4">
          {accounts.length > 0 ? (
            <SegmentedControl
              ariaLabel="Use an existing account or create one"
              value={choice.mode}
              onChange={(value) => set({ mode: value as AccountChoice["mode"] })}
              options={[
                { value: "existing", label: "Existing account" },
                { value: "new", label: "New account" },
              ]}
            />
          ) : null}

          {choice.mode === "existing" && accounts.length > 0 ? (
            <Field label="Account" className="w-full sm:max-w-xs">
              <NativeSelect
                value={choice.existingId}
                onChange={(event) => set({ existingId: event.target.value })}
                aria-label="Account"
                disabled={busy}
                wrapperClassName="w-full"
              >
                {accounts.map((account) => (
                  <NativeSelectOption key={account.id} value={account.id}>
                    {account.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Account name" htmlFor="connect-account-name">
                <FormInput
                  id="connect-account-name"
                  value={choice.name}
                  onChange={(event) => set({ name: event.target.value })}
                  placeholder="e.g. Main Account"
                  disabled={busy}
                />
              </Field>
              <Field label="Base currency" htmlFor="connect-account-currency">
                <FormInput
                  id="connect-account-currency"
                  value={choice.currency}
                  onChange={(event) => set({ currency: event.target.value })}
                  placeholder="USD"
                  disabled={busy}
                />
              </Field>
              <Field label="Account type">
                <NativeSelect
                  value={choice.accountType}
                  onChange={(event) => set({ accountType: event.target.value })}
                  aria-label="Account type"
                  disabled={busy}
                  wrapperClassName="w-full"
                >
                  <NativeSelectOption value="cash">Cash</NativeSelectOption>
                  <NativeSelectOption value="margin">Margin</NativeSelectOption>
                  <NativeSelectOption value="prop">Prop</NativeSelectOption>
                  <NativeSelectOption value="backtest">Backtest (paper)</NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field
                label="Starting balance"
                htmlFor="connect-account-balance"
                description="Saved as the first deposit in the cash ledger."
              >
                <AmountInput
                  id="connect-account-balance"
                  value={choice.startingBalance}
                  onValueChange={(value) => set({ startingBalance: value })}
                  placeholder="0.00"
                  disabled={busy}
                  allowNegative
                />
              </Field>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Setup — the account block plus whatever this broker's connection needs
// ---------------------------------------------------------------------------

interface SetupProps {
  broker: BrokerDef;
  defaultAccountId?: string;
  onBack: () => void;
  onImport: (accountId: string, brokerKey: string) => void;
  onLogTrade?: () => void;
  onDone: () => void;
}

function BrokerSetup({
  broker,
  defaultAccountId,
  onBack,
  onImport,
  onLogTrade,
  onDone,
}: SetupProps) {
  const accountsQ = useAccounts();
  const accounts = accountsQ.data ?? [];
  const createAccount = useCreateAccount();
  const queryClient = useQueryClient();
  const toast = useToastManager();

  const [choice, setChoice] = useState<AccountChoice | null>(null);
  const resolved = choice ?? initialChoice(broker, accounts, defaultAccountId);

  const [queryId, setQueryId] = useState("");
  const [token, setToken] = useState("");
  const [scheduled, setScheduled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [synced, setSynced] = useState<{ inserted: number; skipped: number } | null>(null);

  // Connect and manage used to be two surfaces that didn't know about each
  // other: revisiting /connect on an already-connected account showed a blank
  // form that would silently overwrite. Load what's stored and say so instead.
  const existingAccountId =
    broker.kind === "sync" && resolved.mode === "existing" ? (resolved.existingId ?? "") : "";
  const existingQ = useFlexSync(existingAccountId, existingAccountId !== "");
  const existing = existingAccountId !== "" ? existingQ.data : undefined;
  const connected = existing?.configured === true;
  const [prefilledFor, setPrefilledFor] = useState<string | null>(null);
  useEffect(() => {
    if (!existing?.configured || prefilledFor === existingAccountId) return;
    setPrefilledFor(existingAccountId);
    setQueryId(existing.query_id ?? "");
    setScheduled(existing.enabled);
    setToken("");
  }, [existing, existingAccountId, prefilledFor]);

  /**
   * Resolve the account this connection writes to, creating it when the flow
   * is on "New account". Every action needs one, so it happens on the action
   * rather than as a step the trader has to complete first.
   */
  async function ensureAccount(): Promise<string> {
    if (resolved.mode === "existing" && resolved.existingId) return resolved.existingId;
    const name = resolved.name.trim();
    if (!name) throw new Error("Name the account first.");
    const currency = resolved.currency.trim().toUpperCase() || "USD";
    const created = await createAccount.mutateAsync({
      name,
      broker: broker.accountBroker,
      account_type: resolved.accountType,
      base_currency: currency,
      starting_balance: Number(resolved.startingBalance || 0),
    });
    setChoice({ ...resolved, mode: "existing", existingId: created.id });
    return created.id;
  }

  async function run(action: (accountId: string) => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      const accountId = await ensureAccount();
      await action(accountId);
    } catch (err) {
      setError(errorText(err, "Something went wrong. Try again."));
    } finally {
      setBusy(false);
    }
  }

  function handleConnectSync() {
    if (!queryId.trim()) {
      setError("Flex Query ID is required.");
      return;
    }
    if (!token.trim() && !(connected && existing?.token_set)) {
      setError("Flex Web Service token is required.");
      return;
    }
    void run(async (accountId) => {
      await flexSyncApi.save(accountId, {
        query_id: queryId.trim(),
        // Blank keeps the token already stored for this account.
        ...(token.trim() !== "" ? { token: token.trim() } : {}),
        enabled: scheduled,
      });
      const result = await flexSyncApi.run(accountId);
      // A sync inserts executions and regroups trades.
      void queryClient.invalidateQueries({ queryKey: ["flex-sync", accountId] });
      void queryClient.invalidateQueries({ queryKey: ["trades"] });
      void queryClient.invalidateQueries({ queryKey: ["analytics"] });
      void queryClient.invalidateQueries({ queryKey: ["imports"] });
      setSynced({ inserted: result.inserted, skipped: result.skipped });
      setToken("");
      toast.add({
        title: "Interactive Brokers connected",
        description: `${plural(result.inserted, "execution")} imported`,
      });
    });
  }

  function handleContinueToImport() {
    void run(async (accountId) => {
      onImport(accountId, broker.key);
    });
  }

  function handleManual() {
    void run(async (accountId) => {
      void accountId;
      toast.add({ title: "Account ready", description: resolved.name.trim() || broker.name });
      if (onLogTrade) onLogTrade();
      else onDone();
    });
  }

  const reusesAccount = resolved.mode === "existing" && Boolean(resolved.existingId);
  const canAct =
    !busy && (resolved.mode === "existing" ? reusesAccount : Boolean(resolved.name.trim()));

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-center gap-3">
          <BrokerMark broker={broker} />
          <div className="min-w-0">
            <h1 className="truncate text-[22px] font-semibold tracking-tight text-foreground">
              {broker.name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Pill tone={broker.kind === "sync" ? "accent" : "muted"}>
                {KIND_LABEL[broker.kind]}
              </Pill>
              {broker.formats ? (
                <span className="text-[12px] text-muted-foreground">{broker.formats}</span>
              ) : null}
            </div>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onBack} disabled={busy}>
          <ArrowLeft size={13} strokeWidth={1.75} aria-hidden />
          All brokers
        </Button>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
        <div className="flex flex-col gap-4">
          <AccountPanel
            choice={resolved}
            onChange={setChoice}
            accounts={accounts}
            loading={accountsQ.isLoading}
            busy={busy}
          />

          {broker.kind === "sync" ? (
            <Card
              title="Flex Web Service"
              description="Stored on your server and used by the background sync — nothing is sent anywhere else."
            >
              <div className="flex flex-col gap-3">
                {connected && existing ? (
                  <div className="flex flex-col gap-1 rounded-md bg-muted px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[12px] font-medium">Already connected</span>
                      <Badge
                        variant={
                          flexSyncFailed(existing)
                            ? "destructive-light"
                            : existing.enabled
                              ? "success-light"
                              : "secondary"
                        }
                      >
                        {flexSyncFailed(existing)
                          ? "Sync failing"
                          : existing.enabled
                            ? "Healthy"
                            : "Manual only"}
                      </Badge>
                    </div>
                    <p className="m-0 text-[12px] text-muted-foreground">
                      {existing.last_synced_at
                        ? `Last sync ${new Date(existing.last_synced_at).toLocaleString()} — ${existing.last_status || "done"}`
                        : "Never synced yet."}
                    </p>
                    {existing.last_error ? (
                      <p className="m-0 text-[12px] text-destructive">{existing.last_error}</p>
                    ) : null}
                  </div>
                ) : null}
                <Field label="Flex Query ID" htmlFor="connect-flex-query">
                  <FormInput
                    id="connect-flex-query"
                    value={queryId}
                    onChange={(event) => setQueryId(event.target.value)}
                    placeholder="123456"
                    disabled={busy}
                  />
                </Field>
                <Field
                  label="Flex Web Service token"
                  htmlFor="connect-flex-token"
                  description={
                    connected && existing?.token_set
                      ? `Saved (${existing.token_hint ?? "hidden"}) — leave blank to keep it.`
                      : undefined
                  }
                >
                  <PasswordInput
                    id="connect-flex-token"
                    value={token}
                    onChange={(event) => setToken(event.target.value)}
                    placeholder={connected && existing?.token_set ? "••••••••" : "Paste token"}
                    aria-label="Flex Web Service token"
                    disabled={busy}
                  />
                </Field>
                <Field label="Scheduled sync">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={scheduled}
                      onCheckedChange={setScheduled}
                      aria-label="Scheduled sync"
                      disabled={busy}
                    />
                    <span className="text-[12px] text-muted-foreground">
                      {scheduled
                        ? "New fills arrive automatically in the background"
                        : "Sync only when you ask"}
                    </span>
                  </div>
                </Field>

                {synced ? (
                  <p className="rounded-md bg-profit/10 px-3 py-2 text-[12px] text-profit">
                    {`Connected — ${plural(synced.inserted, "execution")} imported, ${plural(
                      synced.skipped,
                      "duplicate",
                    )} skipped.`}
                  </p>
                ) : null}
                {error ? <p className="text-[12px] text-destructive">{error}</p> : null}

                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" onClick={handleConnectSync} disabled={!canAct}>
                    {busy ? (
                      <>
                        <RefreshCw size={13} strokeWidth={1.5} className="animate-spin" />
                        Connecting…
                      </>
                    ) : synced ? (
                      <>
                        <RefreshCw size={13} strokeWidth={1.5} />
                        Sync again
                      </>
                    ) : (
                      <>
                        {connected ? "Save and sync" : "Connect and sync"}
                        <ArrowRight size={13} strokeWidth={1.5} />
                      </>
                    )}
                  </Button>
                  {synced ? (
                    <Button type="button" variant="outline" onClick={onDone}>
                      <Check size={13} strokeWidth={1.5} />
                      Done
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleContinueToImport}
                      disabled={!canAct}
                    >
                      Upload a statement instead
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ) : null}

          {broker.kind === "file" ? (
            <Card
              title="Import the export"
              description="The next screen previews the file before anything is written."
            >
              <div className="flex flex-col gap-3">
                {error ? <p className="text-[12px] text-destructive">{error}</p> : null}
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" onClick={handleContinueToImport} disabled={!canAct}>
                    {busy ? (
                      <>
                        <RefreshCw size={13} strokeWidth={1.5} className="animate-spin" />
                        Preparing…
                      </>
                    ) : (
                      <>
                        <Upload size={13} strokeWidth={1.5} />
                        Continue to upload
                      </>
                    )}
                  </Button>
                  {onLogTrade ? (
                    <Button type="button" variant="ghost" onClick={handleManual} disabled={!canAct}>
                      Log a trade by hand instead
                    </Button>
                  ) : null}
                </div>
              </div>
            </Card>
          ) : null}

          {broker.kind === "manual" ? (
            <Card
              title="Start journaling"
              description={
                reusesAccount
                  ? "The trade form opens on the account you picked."
                  : "The account is created, then the trade form opens."
              }
            >
              <div className="flex flex-col gap-3">
                {error ? <p className="text-[12px] text-destructive">{error}</p> : null}
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" onClick={handleManual} disabled={!canAct}>
                    {busy ? (
                      <>
                        <RefreshCw size={13} strokeWidth={1.5} className="animate-spin" />
                        {reusesAccount ? "Opening…" : "Creating…"}
                      </>
                    ) : (
                      <>
                        <PenLine size={13} strokeWidth={1.5} />
                        {reusesAccount ? "Log a trade" : "Create and log a trade"}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          ) : null}
        </div>

        <Card title={STEPS_TITLE[broker.kind](broker)} className="self-start lg:sticky lg:top-6">
          <BrokerSteps broker={broker} />
        </Card>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------

export interface ConnectViewProps {
  /** Selected broker key, carried in the URL so the step is linkable. */
  brokerKey?: string;
  defaultAccountId?: string;
  onSelectBroker: (key: string | null) => void;
  onImport: (accountId: string, brokerKey: string) => void;
  onLogTrade?: () => void;
  onDone: () => void;
}

/**
 * Connect a broker — pick the platform first, then do whatever that platform
 * supports.
 *
 * The import page stays as the raw file path for people who already know what
 * they have; this route is the one that answers "I trade at X, now what?".
 */
export function ConnectView({
  brokerKey,
  defaultAccountId,
  onSelectBroker,
  onImport,
  onLogTrade,
  onDone,
}: ConnectViewProps) {
  const broker = findBroker(brokerKey);

  return (
    <Page>
      {broker ? (
        <BrokerSetup
          key={broker.key}
          broker={broker}
          defaultAccountId={defaultAccountId}
          onBack={() => onSelectBroker(null)}
          onImport={onImport}
          onLogTrade={onLogTrade}
          onDone={onDone}
        />
      ) : (
        <>
          <header className="min-w-0">
            <h1 className="text-[22px] font-semibold tracking-tight text-foreground">
              Connect a broker
            </h1>
            <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
              Pick where you trade. We&apos;ll show you how to get the data out and set the account
              up for it.
            </p>
          </header>
          <BrokerPicker onSelect={(key) => onSelectBroker(key)} />
        </>
      )}
    </Page>
  );
}
