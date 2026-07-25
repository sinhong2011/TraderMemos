import { AlertCircle, Settings2 } from "lucide-react";
import { useId, useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { Field } from "@/components/Field";
import { FormInput, PasswordInput } from "@/components/FormInput";
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
      const tokens = await authApi.login(loginEmail, loginPassword);
      signIn(tokens.access_token, tokens.refresh_token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
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
            />
          </Field>
        </div>

        {error ? (
          <Alert variant="error">
            <AlertCircle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="submit" variant="default" className="w-full" disabled={busy}>
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
