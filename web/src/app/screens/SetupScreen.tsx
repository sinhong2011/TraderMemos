import { AlertCircle, Check, Settings2 } from "lucide-react";
import { useId, useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { CsvDropZone } from "@/components/CsvDropZone";
import { Field } from "@/components/Field";
import { authFieldClass, fieldLabelClass } from "@/components/field-styles";
import { FormInput, PasswordInput } from "@/components/FormInput";
import { Modal } from "@/components/Modal";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { authApi } from "@/lib/api/auth";
import {
  ApiError,
  editableApiBaseUrl,
  getCustomApiBaseUrl,
  getBaseUrl,
  setBaseUrl,
} from "@/lib/api/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";

const MIN_PASSWORD = 10;

function SetupStepIndicator({ step }: { step: 1 | 2 }) {
  const steps = [
    { n: 1 as const, label: "Account" },
    { n: 2 as const, label: "Import" },
  ];

  return (
    <div aria-label={`Setup step ${step} of 2`}>
      <div className="flex items-center gap-3">
        {steps.map(({ n, label }, index) => (
          <div key={n} className="contents">
            {index > 0 ? (
              <div
                className={cn(
                  "h-px min-w-[3rem] flex-1 rounded-full transition-colors",
                  step > n - 1 ? "bg-primary/40" : "bg-border",
                )}
                aria-hidden
              />
            ) : null}
            <div className="flex shrink-0 items-center gap-2.5">
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums transition-colors",
                  step === n
                    ? "bg-primary text-primary-foreground"
                    : step > n
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {step > n ? <Check size={13} strokeWidth={2.5} aria-hidden /> : n}
              </span>
              <span
                className={cn(
                  "text-[10px] font-medium tracking-[0.08em] uppercase",
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

export function SetupScreen() {
  const signIn = useAuth((s) => s.signIn);
  const formId = useId();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [serverUrl, setServerUrl] = useState(() => editableApiBaseUrl(getCustomApiBaseUrl()));
  const [accountName, setAccountName] = useState("Main");
  const [currency, setCurrency] = useState("USD");
  const [balance, setBalance] = useState("");
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
    <AuthShell>
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 id={`${formId}-title`} className="text-xl font-semibold tracking-tight text-foreground">
          {step === 1 ? "Set up" : "Optional import"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {step === 1
            ? "One-time bootstrap for a fresh self-hosted deploy."
            : "Seed your journal from a backup, or start empty."}
        </p>
      </div>

      <SetupStepIndicator step={step} />

      <form onSubmit={handleContinue} className="flex flex-col gap-4">
        {step === 1 ? (
          <div className="flex flex-col gap-3.5">
            <Field label="Username" htmlFor="setup-username">
              <FormInput
                id="setup-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="owner"
                autoComplete="username"
                autoFocus
                required
                spellCheck={false}
                className={authFieldClass}
              />
            </Field>

            <Field
              label="Password"
              htmlFor="setup-password"
              description={`Minimum ${MIN_PASSWORD} characters.`}
            >
              <PasswordInput
                id="setup-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={`At least ${MIN_PASSWORD} characters`}
                autoComplete="new-password"
                required
                className={authFieldClass}
              />
            </Field>

            <Field label="Confirm password" htmlFor="setup-confirm">
              <PasswordInput
                id="setup-confirm"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat password"
                autoComplete="new-password"
                required
                className={authFieldClass}
              />
            </Field>

            <Field
              label="Trading account"
              htmlFor="setup-account"
              description="Created for your journal — change anytime in Settings."
            >
              <FormInput
                id="setup-account"
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="Main"
                required
                spellCheck={false}
                className={authFieldClass}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Currency" htmlFor="setup-currency">
                <FormInput
                  id="setup-currency"
                  type="text"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  placeholder="USD"
                  spellCheck={false}
                  className={authFieldClass}
                />
              </Field>
              <Field
                label="Starting balance"
                htmlFor="setup-balance"
                description="Recorded as the first deposit in your cash ledger. Leave blank to start at zero and add deposits later."
              >
                <FormInput
                  id="setup-balance"
                  type="text"
                  inputMode="decimal"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                  placeholder="0"
                  spellCheck={false}
                  className={authFieldClass}
                />
              </Field>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <p className={cn(fieldLabelClass, "mb-2")}>Optional</p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Drop a TraderMemos export or broker history file. You can always import from
                Settings → Import & export.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {[".csv", ".json"].map((ext) => (
                  <span
                    key={ext}
                    className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                  >
                    {ext}
                  </span>
                ))}
              </div>
            </div>
            <CsvDropZone file={importFile} onFileChange={setImportFile} disabled={busy} />
            {!importFile ? (
              <p className="text-[11px] text-muted-foreground">No file selected — safe to skip.</p>
            ) : (
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground">
                  Ready to import after your owner account is created.
                </p>
                <p className="text-[11px] text-muted-foreground">
                  JSON account id is ignored — data imports into the account you create here.
                  Broker, starting balance, and cash deposits/withdrawals are restored when present.
                </p>
              </div>
            )}
          </div>
        )}

        {error ? (
          <Alert variant="error">
            <AlertCircle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {step === 1 ? (
          <>
            <Button type="submit" variant="default" className="w-full" disabled={busy}>
              Continue
            </Button>
            <div className="flex justify-center">
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
                  <span className="max-w-[10rem] truncate text-muted-foreground" title={serverUrl}>
                    · custom server
                  </span>
                ) : null}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="default"
              className="w-full"
              onClick={() => void finishSetup()}
              disabled={busy}
            >
              {busy ? "Finishing…" : importFile ? "Create & import" : "Create owner account"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
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
              className="w-full text-muted-foreground hover:text-foreground"
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
        <Field
          label="API server"
          htmlFor="setup-server-url"
          info={
            <>
              Leave blank for the default. Origin only — <code>/api/v1</code> is added
              automatically.
            </>
          }
        >
          <FormInput
            id="setup-server-url"
            type="text"
            inputMode="url"
            spellCheck={false}
            autoFocus
            autoComplete="url"
            placeholder="https://example.com"
            aria-label="API server"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            onBlur={() => {
              setBaseUrl(serverUrl);
              setServerUrl(editableApiBaseUrl(getCustomApiBaseUrl()));
            }}
          />
        </Field>
      </Modal>
    </AuthShell>
  );
}
