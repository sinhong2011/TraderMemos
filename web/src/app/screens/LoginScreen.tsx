import { AlertCircle, Settings2 } from "lucide-react";
import { useId, useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { Field } from "@/components/Field";
import { FormInput, PasswordInput } from "@/components/FormInput";
import { authFieldClass } from "@/components/field-styles";
import { Modal } from "@/components/Modal";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Button } from "@/components/ui/button";
import { authApi } from "@/lib/api/auth";
import { ApiError, editableApiBaseUrl, getCustomApiBaseUrl, setBaseUrl } from "@/lib/api/client";
import { useAuth } from "@/lib/auth";

const MODES = [
  { value: "login", label: "Sign in" },
  { value: "register", label: "Create account" },
] as const;

type AuthMode = (typeof MODES)[number]["value"];

const MIN_PASSWORD = 10;

export function LoginScreen({
  registrationOpen = false,
  banner = "",
}: {
  registrationOpen?: boolean;
  banner?: string;
}) {
  const signIn = useAuth((s) => s.signIn);
  const formId = useId();

  const modes = registrationOpen ? [...MODES] : MODES.filter((m) => m.value === "login");

  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [serverUrl, setServerUrl] = useState(() => editableApiBaseUrl(getCustomApiBaseUrl()));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  // Revealed only once the server answers `totp_required`, which means the
  // password already checked out — so the form stays two fields for accounts
  // without a second factor.
  const [totpCode, setTotpCode] = useState("");
  const [needsTotp, setNeedsTotp] = useState(false);

  async function completeSignIn(
    loginEmail: string,
    loginPassword: string,
    asRegister = mode === "register",
  ) {
    setError("");
    setBusy(true);
    try {
      setBaseUrl(serverUrl);
      if (asRegister) {
        await authApi.register(loginEmail, loginPassword);
      }
      const tokens = await authApi.login(loginEmail, loginPassword, totpCode.trim() || undefined);
      signIn(tokens.access_token, tokens.refresh_token);
    } catch (err) {
      // `totp_required` is not a failure to report — the password was accepted
      // and the server is asking for the second factor.
      if (err instanceof ApiError && err.code === "totp_required") {
        setNeedsTotp(true);
        setError("");
      } else if (err instanceof ApiError && err.code === "totp_invalid") {
        setNeedsTotp(true);
        setError("That code is not valid. Codes change every 30 seconds.");
      } else {
        setError(err instanceof ApiError ? err.message : "Something went wrong");
      }
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await completeSignIn(email, password);
  }

  function switchMode(next: AuthMode) {
    setMode(next);
    setError("");
    setPassword("");
    setTotpCode("");
    setNeedsTotp(false);
    if (next === "register") {
      setEmail("");
    }
  }

  const isLogin = mode === "login";

  return (
    <AuthShell>
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 id={`${formId}-title`} className="text-xl font-semibold tracking-tight text-foreground">
          {isLogin ? "Sign in" : "Create your account"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isLogin ? "Welcome back." : "Your trade data stays on your stack."}
        </p>
      </div>

      {modes.length > 1 ? (
        <div className="flex justify-center">
          <SegmentedControl
            ariaLabel="Authentication mode"
            options={modes}
            value={mode}
            onChange={(v) => switchMode(v as AuthMode)}
            size="sm"
          />
        </div>
      ) : null}

      {banner ? (
        <Alert variant="warning">
          <AlertCircle />
          <AlertDescription>{banner}</AlertDescription>
        </Alert>
      ) : null}

      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-3.5">
          <Field label="Username" htmlFor="username">
            <FormInput
              id="username"
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your username"
              autoComplete="username"
              autoFocus
              required
              spellCheck={false}
              className={authFieldClass}
            />
          </Field>

          <Field
            label="Password"
            htmlFor="password"
            description={
              isLogin
                ? undefined
                : `Use ${MIN_PASSWORD}+ characters with a mix of letters and numbers.`
            }
          >
            <PasswordInput
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isLogin ? "Enter your password" : `At least ${MIN_PASSWORD} characters`}
              autoComplete={isLogin ? "current-password" : "new-password"}
              required
              className={authFieldClass}
            />
          </Field>
          {needsTotp ? (
            <Field label="Authenticator code" htmlFor="totp-code">
              <FormInput
                id="totp-code"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                placeholder="6-digit code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                autoFocus
                required
                className={authFieldClass}
              />
            </Field>
          ) : null}
        </div>

        {error ? (
          <Alert variant="error">
            <AlertCircle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {/* `loading` (not just `disabled`) — a greyed button with swapped copy
            never said the request was in flight, only that the form was shut.
            Full width, so the pending label costs no reflow. */}
        <Button type="submit" variant="default" className="w-full" loading={busy}>
          {busy
            ? isLogin
              ? "Signing in…"
              : "Creating account…"
            : isLogin
              ? "Sign in"
              : "Create account"}
        </Button>
      </form>

      <div className="flex flex-col items-center gap-2">
        {registrationOpen && isLogin ? (
          <p className="text-center text-sm text-muted-foreground">
            Need an account?{" "}
            <Button
              type="button"
              variant="link"
              className="h-auto p-0"
              onClick={() => switchMode("register")}
            >
              Sign up
            </Button>
          </p>
        ) : null}
        {!isLogin ? (
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Button
              type="button"
              variant="link"
              className="h-auto p-0"
              onClick={() => switchMode("login")}
            >
              Sign in
            </Button>
          </p>
        ) : null}
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
          htmlFor="server-url"
          info={
            <>
              Host for this device. Leave blank for the default. Origin only — <code>/api/v1</code>{" "}
              is added automatically.
            </>
          }
        >
          <FormInput
            id="server-url"
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
