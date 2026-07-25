import { AlertCircle, ArrowRight, Settings2 } from "lucide-react";
import { useId, useState } from "react";
import { AppLogo } from "@/components/AppLogo";
import { Field } from "@/components/Field";
import { fieldHintClass, fieldLabelClass } from "@/components/field-styles";
import { FormInput, PasswordInput } from "@/components/FormInput";
import { Modal } from "@/components/Modal";
import { Alert, AlertDescription } from "@/components/reui/alert";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { authApi } from "@/lib/api/auth";
import { ApiError, editableApiBaseUrl, getCustomApiBaseUrl, setBaseUrl } from "@/lib/api/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";

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
    <div className="relative flex min-h-full bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_0%_0%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_55%),radial-gradient(ellipse_45%_40%_at_100%_100%,color-mix(in_oklch,var(--profit)_6%,transparent),transparent_50%)]"
      />

      <div
        className={cn(
          "relative z-[1] mx-auto grid w-full max-w-[1040px] flex-1",
          "lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]",
          "items-stretch gap-0 px-6 py-10 sm:px-8 sm:py-12",
          "max-lg:items-start max-lg:gap-10 max-lg:py-8",
        )}
      >
        <aside
          className="flex flex-col justify-between gap-10 lg:pr-12 xl:pr-16"
          aria-hidden="true"
        >
          <div>
            <div className="mb-10 flex items-center gap-3">
              <AppLogo size={36} />
              <span className="text-[15px] font-semibold tracking-tight text-foreground">
                TraderMemos
              </span>
            </div>

            <p className={cn(fieldLabelClass, "mb-3")}>Trading journal</p>
            <h1 className="m-0 max-w-[14ch] text-[clamp(2rem,4.2vw,2.75rem)] leading-[1.05] font-semibold tracking-[-0.04em] text-foreground">
              Your P&amp;L,
              <br />
              on the grid.
            </h1>
            <p className="mt-5 max-w-[36ch] text-[13px] leading-relaxed text-muted-foreground">
              Dense stats. Quiet chrome. Review the session without the noise.
            </p>
          </div>

          <dl className="hidden grid-cols-2 gap-8 lg:grid">
            <div>
              <dt className={fieldLabelClass}>Net P&amp;L</dt>
              <dd className="m-0 mt-1 text-[1.5rem] font-semibold tracking-tight tabular-nums text-profit">
                +$2,847
              </dd>
            </div>
            <div>
              <dt className={fieldLabelClass}>Win rate</dt>
              <dd className="m-0 mt-1 text-[1.5rem] font-semibold tracking-tight tabular-nums text-foreground">
                68.4%
              </dd>
            </div>
          </dl>
        </aside>

        <section
          className={cn(
            "flex flex-col justify-center",
            "rounded-xl bg-card px-7 py-8 sm:px-9 sm:py-10",
            "lg:my-auto lg:max-h-[min(640px,calc(100vh-6rem))]",
          )}
          aria-labelledby={`${formId}-title`}
        >
          <div className="mx-auto flex w-full max-w-[22rem] flex-col">
            {modes.length > 1 ? (
              <div className="mb-7 flex justify-center">
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
              <Alert variant="warning" className="mb-5">
                <AlertCircle />
                <AlertDescription>{banner}</AlertDescription>
              </Alert>
            ) : null}

            <form onSubmit={submit} className="flex flex-col gap-5">
              <header>
                <h2
                  id={`${formId}-title`}
                  className="mb-1 text-[1.125rem] font-semibold tracking-tight text-foreground"
                >
                  {isLogin ? "Welcome back" : "Start your journal"}
                </h2>
                <p className="text-[12px] leading-relaxed text-muted-foreground">
                  {isLogin
                    ? "Pick up where your last session left off."
                    : "Your trade data stays on your stack."}
                </p>
              </header>

              <div className="flex flex-col gap-4">
                <Field label="Username" htmlFor="username">
                  <FormInput
                    id="username"
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="owner"
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
                    placeholder={isLogin ? "Your password" : `At least ${MIN_PASSWORD} characters`}
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    required
                  />
                </Field>
              </div>

              {error ? (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <Button
                type="submit"
                variant="default"
                size="lg"
                className="h-10 w-full"
                disabled={busy}
              >
                <span>
                  {busy
                    ? isLogin
                      ? "Signing in…"
                      : "Creating account…"
                    : isLogin
                      ? "Sign in"
                      : "Create account"}
                </span>
                {!busy ? <ArrowRight size={14} strokeWidth={2} aria-hidden /> : null}
              </Button>

              <div className="flex flex-col items-center gap-2.5 pt-1">
                <p className="text-[11px] text-muted-foreground">
                  Press <Kbd>Enter</Kbd> to continue
                </p>
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
              <Field label="API server" htmlFor="server-url">
                <FormInput
                  id="server-url"
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
                />
                <p className={fieldHintClass}>
                  API host for this device. Leave blank for the default. You only need the origin —
                  /api/v1 is added automatically.
                </p>
              </Field>
            </Modal>
          </div>
        </section>
      </div>
    </div>
  );
}
