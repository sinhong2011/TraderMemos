import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, Settings2, User, Wallet } from "lucide-react";
import { useId, useState } from "react";
import { AppLogo } from "../../components/AppLogo";
import { CsvDropZone } from "../../components/CsvDropZone";
import { Modal } from "../../components/Modal";
import { SignalInput } from "../../components/SignalInput";
import { Button } from "../../components/ui/button";
import { Kbd } from "../../components/ui/kbd";
import { authApi } from "../../lib/api/auth";
import {
  ApiError,
  editableApiBaseUrl,
  getCustomApiBaseUrl,
  getBaseUrl,
  setBaseUrl,
} from "../../lib/api/client";
import { useAuth } from "../../lib/auth";
import { cn } from "../../lib/cn";

const labelClass = "text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground";
const MIN_PASSWORD = 10;

function SetupStepIndicator({ step }: { step: 1 | 2 }) {
  const steps = [
    { n: 1 as const, label: "Account" },
    { n: 2 as const, label: "Import" },
  ];

  return (
    <div className="mb-6 px-4 py-2.5" aria-label={`Setup step ${step} of 2`}>
      <div className="flex items-center gap-3">
        {steps.map(({ n, label }, index) => (
          <div key={n} className="contents">
            {index > 0 ? (
              <div
                className={cn(
                  "h-px min-w-[4.5rem] flex-1",
                  step > n ? "bg-accent/45" : "bg-border-strong",
                )}
                aria-hidden
              />
            ) : null}
            <div className="flex shrink-0 items-center gap-2.5">
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums transition-colors",
                  step === n
                    ? "border border-primary/70 bg-accent/12 text-primary"
                    : step > n
                      ? "bg-primary text-background"
                      : "bg-accent text-muted-foreground",
                )}
              >
                {n}
              </span>
              <span
                className={cn(
                  "text-[11px] font-medium",
                  step >= n ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({
  label,
  id,
  type,
  value,
  onChange,
  placeholder,
  hint,
  autoComplete,
  autoFocus,
  required = true,
  icon: Icon,
}: {
  label: string;
  id: string;
  type: "email" | "password" | "text" | "number";
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  required?: boolean;
  icon?: typeof User;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword && showPassword ? "text" : type;
  const FieldIcon = Icon ?? (isPassword ? Lock : User);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="group relative flex items-center">
        <FieldIcon
          size={15}
          strokeWidth={1.5}
          className="pointer-events-none absolute left-3 text-muted-foreground transition-colors group-focus-within:text-primary"
          aria-hidden
        />
        <input
          id={id}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "h-11 w-full rounded-md border-none bg-muted py-0 pl-10 text-[13px] text-foreground outline-none transition-[background-color] duration-150 placeholder:text-muted-foreground hover:bg-accent focus:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            isPassword ? "pr-10" : "pr-3",
          )}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          required={required}
          spellCheck={false}
        />
        {isPassword && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute right-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
          </Button>
        )}
      </div>
      <p
        className={cn(
          "min-h-[1rem] text-[11px] leading-snug text-muted-foreground",
          !hint && "invisible",
        )}
      >
        {hint ?? "\u00a0"}
      </p>
    </div>
  );
}

export function SetupScreen() {
  const signIn = useAuth((s) => s.signIn);
  const formId = useId();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [serverUrl, setServerUrl] = useState(() => editableApiBaseUrl(getCustomApiBaseUrl()));
  const [accountName, setAccountName] = useState("Main");
  const [currency, setCurrency] = useState("USD");
  const [balance, setBalance] = useState("10000");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  async function importAfterSetup(accessToken: string, accountID: string, file: File) {
    const previewForm = new FormData();
    previewForm.append("file", file);
    previewForm.append("account_id", accountID);
    const previewRes = await fetch(`${getBaseUrl()}/imports`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: previewForm,
    });
    const previewBody = await previewRes.json().catch(() => ({}) as Record<string, unknown>);
    if (!previewRes.ok) {
      const message =
        typeof previewBody?.error === "object" &&
        previewBody.error &&
        typeof (previewBody.error as { message?: unknown }).message === "string"
          ? (previewBody.error as { message: string }).message
          : "Could not preview initial import ";
      throw new Error(message);
    }
    const suggestedMapping =
      typeof previewBody.suggested_mapping === "object" && previewBody.suggested_mapping
        ? (previewBody.suggested_mapping as Record<string, string>)
        : {};
    const format = typeof previewBody.format === "string" ? previewBody.format : "";
    const mapping = format === "journal_trades" ? {} : suggestedMapping;
    const commitForm = new FormData();
    commitForm.append("file", file);
    commitForm.append("account_id", accountID);
    commitForm.append("column_mapping", JSON.stringify(mapping));
    const commitRes = await fetch(`${getBaseUrl()}/imports/commit`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: commitForm,
    });
    if (!commitRes.ok) {
      const commitBody = await commitRes.json().catch(() => ({}) as Record<string, unknown>);
      const message =
        typeof commitBody?.error === "object" &&
        commitBody.error &&
        typeof (commitBody.error as { message?: unknown }).message === "string"
          ? (commitBody.error as { message: string }).message
          : "Could not complete initial import ";
      throw new Error(message);
    }
  }

  async function finishSetup() {
    if (password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      setBaseUrl(serverUrl);
      const starting = Number.parseFloat(balance);
      const result = await authApi.completeSetup(username, password, {
        name: accountName.trim() || "Main",
        base_currency: currency.trim() || "USD",
        starting_balance: Number.isFinite(starting) ? starting : 0,
      });
      if (importFile) {
        const accountID =
          typeof result.account === "object" &&
          result.account &&
          typeof (result.account as { id?: unknown }).id === "string"
            ? ((result.account as { id: string }).id ?? "")
            : "";
        if (!accountID) {
          throw new Error("Setup finished but no account id was returned for import ");
        }
        await importAfterSetup(result.access_token, accountID, importFile);
      }
      signIn(result.access_token, result.refresh_token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  function handleContinue(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!username.trim()) {
      setError("Username is required.");
      return;
    }
    setStep(2);
  }

  return (
    <div className="relative flex min-h-full items-center justify-center p-6 max-[820px]:items-start max-[820px]:p-4">
      <div className="relative z-[1] grid h-[min(720px,calc(100vh-48px))] w-full max-w-[920px] grid-cols-[1fr_420px] overflow-hidden border border-border bg-background shadow-md max-[820px]:h-auto max-[820px]:grid-cols-1">
        <aside
          className="relative flex flex-col justify-between overflow-hidden border-r border-border bg-sidebar p-10 max-[820px]:border-r-0 max-[820px]:border-b max-[820px]:p-7"
          aria-hidden="true"
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(ellipse 80% 60% at 0% 0%, rgba(167,139,250,0.14), transparent 55%), radial-gradient(ellipse 50% 40% at 100% 100%, rgba(74,222,128,0.06), transparent 50%)",
            }}
          />
          <div className="relative">
            <div className="mb-8 flex items-center gap-2.5">
              <AppLogo
                size={32}
                className="shadow-[0_0_20px_color-mix(in oklch, var(--primary) 35%, transparent)]"
              />
              <span className="text-[13px] font-medium tracking-tight text-foreground">
                TraderMemos
              </span>
            </div>
            <p className={cn(labelClass, "mb-3 text-chart-3")}>First install</p>
            <h1 className="m-0 text-[clamp(28px,3.4vw,36px)] leading-[1.05] font-bold tracking-[-0.04em] text-foreground">
              Claim this
              <br />
              <span className="text-primary">instance.</span>
            </h1>
            <p className="mt-4 max-w-[34ch] text-[13px] leading-relaxed text-muted-foreground">
              Create the owner account. Public registration stays closed unless you opt in later.
            </p>
          </div>
          <ul className="relative m-0 list-none space-y-2 p-0 text-[12px] text-muted-foreground max-[820px]:mt-6">
            <li>Owner account becomes the instance admin</li>
            <li>Optional trading account so you can journal immediately</li>
            <li>Put TLS in front (Caddy / Traefik) for production</li>
          </ul>
        </aside>

        <section
          className={cn(
            "flex h-full flex-col overflow-y-auto bg-background px-8 py-8 max-[820px]:px-6 max-[820px]:py-7",
            step === 1 ? "justify-center max-[820px]:justify-start" : "justify-start pt-10",
          )}
          aria-labelledby={`${formId}-title`}
        >
          <div className="mx-auto flex w-full max-w-[340px] flex-col">
            <header className="mb-4">
              <h2
                id={`${formId}-title`}
                className="mb-1 text-[17px] font-semibold tracking-tight text-foreground"
              >
                {step === 1 ? "Setup wizard" : "Optional import "}
              </h2>
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                {step === 1
                  ? "One-time bootstrap for a fresh self-hosted deploy."
                  : "Seed your journal from a backup, or start empty and import later."}
              </p>
            </header>

            <SetupStepIndicator step={step} />

            <form onSubmit={handleContinue} className="flex flex-col">
              {step === 1 ? (
                <div className="flex flex-col gap-1">
                  <Field
                    label="Username"
                    id="setup-username"
                    type="text"
                    value={username}
                    onChange={setUsername}
                    placeholder="owner"
                    autoComplete="username"
                    autoFocus
                  />
                  <Field
                    label="Password"
                    id="setup-password"
                    type="password"
                    value={password}
                    onChange={setPassword}
                    placeholder={`At least ${MIN_PASSWORD} characters`}
                    hint={`Minimum ${MIN_PASSWORD} characters.`}
                    autoComplete="new-password"
                  />
                  <Field
                    label="Confirm password"
                    id="setup-confirm"
                    type="password"
                    value={confirm}
                    onChange={setConfirm}
                    placeholder="Repeat password"
                    autoComplete="new-password"
                  />
                  <Field
                    label="Trading account"
                    id="setup-account"
                    type="text"
                    value={accountName}
                    onChange={setAccountName}
                    placeholder="Main"
                    icon={Wallet}
                    hint="Created for your journal — change anytime in Settings."
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Field
                      label="Currency"
                      id="setup-currency"
                      type="text"
                      value={currency}
                      onChange={setCurrency}
                      placeholder="USD"
                      required={false}
                      icon={Wallet}
                    />
                    <Field
                      label="Starting balance"
                      id="setup-balance"
                      type="number"
                      value={balance}
                      onChange={setBalance}
                      placeholder="10000"
                      required={false}
                      icon={Wallet}
                      hint="Recorded as the first deposit in your cash ledger."
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4 rounded-md bg-card p-4">
                  <div>
                    <p className={cn(labelClass, "mb-2 text-chart-3")}>Optional</p>
                    <p className="text-[12px] leading-relaxed text-muted-foreground">
                      Drop a TraderMemos export or broker history file. You can always import from
                      Settings → Import & export.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {[".csv", ".json"].map((ext) => (
                        <span
                          key={ext}
                          className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                        >
                          {ext}
                        </span>
                      ))}
                    </div>
                  </div>
                  <CsvDropZone file={importFile} onFileChange={setImportFile} disabled={busy} />
                  {!importFile ? (
                    <p className="text-[11px] text-muted-foreground">
                      No file selected — safe to skip.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-[11px] text-muted-foreground">
                        Ready to import after your owner account is created.
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        JSON account id is ignored — data imports into the account you create here.
                        Broker, starting balance, and cash deposits/withdrawals are restored when
                        present.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div
                  className="mt-1 flex items-start gap-2 rounded-md border border-[rgba(251,113,133,0.22)] bg-[rgba(251,113,133,0.08)] px-3 py-2.5 text-xs leading-snug text-destructive"
                  role="alert"
                >
                  <AlertCircle size={14} strokeWidth={1.5} aria-hidden />
                  <span>{error}</span>
                </div>
              )}

              {step === 1 ? (
                <>
                  <Button
                    type="submit"
                    variant="default"
                    size="lg"
                    className="group mt-4 h-11 w-full border border-border hover:shadow-[0_0_28px_color-mix(in oklch, var(--primary) 35%, transparent)] active:scale-[0.99] disabled:active:scale-100"
                    disabled={busy}
                  >
                    <span>Continue</span>
                    <ArrowRight
                      size={14}
                      strokeWidth={2}
                      className="transition-transform duration-150 group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </Button>

                  <p className="mt-4 text-center text-[11px] text-muted-foreground">
                    Press <Kbd>Enter</Kbd> to continue
                  </p>
                  <div className="mt-2 flex items-center justify-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setAdvancedOpen(true)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Settings2 size={12} strokeWidth={1.5} aria-hidden />
                      Advanced
                      {serverUrl ? (
                        <span
                          className="max-w-[10rem] truncate text-muted-foreground"
                          title={serverUrl}
                        >
                          · custom server
                        </span>
                      ) : null}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="mt-5 flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="default"
                    size="lg"
                    className="group h-11 w-full border border-border hover:shadow-[0_0_28px_color-mix(in oklch, var(--primary) 35%, transparent)] active:scale-[0.99] disabled:active:scale-100"
                    onClick={() => void finishSetup()}
                    disabled={busy}
                  >
                    <span>
                      {busy
                        ? "Finishing…"
                        : importFile
                          ? "Create & import "
                          : "Create owner account"}
                    </span>
                    {!busy ? (
                      <ArrowRight
                        size={14}
                        strokeWidth={2}
                        className="transition-transform duration-150 group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    ) : null}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 w-full"
                    onClick={() => {
                      setImportFile(null);
                      void finishSetup();
                    }}
                    disabled={busy}
                  >
                    Skip for now
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-9 w-full text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setError("");
                      setStep(1);
                    }}
                    disabled={busy}
                  >
                    Back to account
                  </Button>
                </div>
              )}
            </form>
            <Modal
              open={advancedOpen}
              onOpenChange={setAdvancedOpen}
              title="Advanced"
              className="max-w-[min(400px,94vw)]"
              footer={
                <Button
                  type="button"
                  variant="default"
                  onClick={() => {
                    setBaseUrl(serverUrl);
                    setServerUrl(editableApiBaseUrl(getCustomApiBaseUrl()));
                    setAdvancedOpen(false);
                  }}
                >
                  Save
                </Button>
              }
            >
              <div className="flex flex-col gap-1.5">
                <label htmlFor="setup-server-url" className={labelClass}>
                  API server
                </label>
                <SignalInput
                  id="setup-server-url"
                  type="text"
                  inputMode="url"
                  spellCheck={false}
                  autoFocus
                  autoComplete="url"
                  placeholder="https://your-host"
                  aria-label="API server"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  onBlur={() => {
                    setBaseUrl(serverUrl);
                    setServerUrl(editableApiBaseUrl(getCustomApiBaseUrl()));
                  }}
                  className="h-10 w-full text-[13px]"
                />
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Leave blank for the default. Origin only — /api/v1 is added automatically.
                </p>
              </div>
            </Modal>
          </div>
        </section>
      </div>
    </div>
  );
}
