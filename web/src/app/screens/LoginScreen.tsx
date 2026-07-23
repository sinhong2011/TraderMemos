import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, Settings2, User } from "lucide-react";
import { useId, useState } from "react";
import { AppLogo } from "../../components/AppLogo";
import { AuthModeTabs } from "../../components/AuthModeTabs";
import { Modal } from "../../components/Modal";
import { SignalInput } from "../../components/SignalInput";
import { Button } from "../../components/ui/button";
import { Kbd } from "../../components/ui/kbd";
import { authApi } from "../../lib/api/auth";
import {
  ApiError,
  editableApiBaseUrl,
  getCustomApiBaseUrl,
  setBaseUrl,
} from "../../lib/api/client";
import { useAuth } from "../../lib/auth";
import { cn } from "../../lib/cn";

const MODES = [
  { value: "login", label: "Sign in" },
  { value: "register", label: "Create account" },
] as const;

type AuthMode = (typeof MODES)[number]["value"];

const labelClass = "text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted";
const MIN_PASSWORD = 10;

function AuthField({
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
  type: "password" | "text";
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
          className="pointer-events-none absolute left-3 text-text-dim transition-colors group-focus-within:text-accent"
          aria-hidden
        />
        <input
          id={id}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "h-11 w-full rounded-control border-none bg-bg-input py-0 pl-10 text-[13px] text-text outline-none transition-[background-color] duration-150 placeholder:text-text-dim hover:bg-bg-input-hover focus:bg-bg-input-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-strong",
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
            size="icon"
            className="absolute right-1.5"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <EyeOff size={15} strokeWidth={1.5} />
            ) : (
              <Eye size={15} strokeWidth={1.5} />
            )}
          </Button>
        )}
      </div>
      <p
        className={cn(
          "min-h-[1.35em] text-[11px] leading-snug text-text-dim",
          !hint && "invisible",
        )}
      >
        {hint ?? "\u00a0"}
      </p>
    </div>
  );
}

export function LoginScreen({
  registrationOpen = false,
  banner = "",
}: {
  registrationOpen?: boolean;
  banner?: string;
}) {
  const signIn = useAuth((s) => s.signIn);
  const formId = useId();

  const modes = registrationOpen ? MODES : MODES.filter((m) => m.value === "login");

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
    <div className="signal-app relative flex min-h-full items-center justify-center p-6 max-[820px]:items-start max-[820px]:p-4">
      <div className="signal-app-grid-scan" aria-hidden />
      <div className="signal-app-grain" aria-hidden />

      <div className="relative z-[1] grid h-[min(640px,calc(100vh-48px))] w-full max-w-[920px] grid-cols-[1fr_400px] overflow-hidden border border-border-strong bg-bg shadow-hard max-[820px]:h-auto max-[820px]:grid-cols-1">
        {/* Brand panel */}
        <aside
          className="relative flex flex-col justify-between overflow-hidden border-r border-border bg-bg-elevated p-10 max-[820px]:border-r-0 max-[820px]:border-b max-[820px]:p-7"
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
              <AppLogo size={32} className="shadow-[0_0_20px_var(--color-accent-glow)]" />
              <span className="text-[13px] font-medium tracking-tight text-text">TraderMemos</span>
            </div>

            <p className={cn(labelClass, "mb-3 text-signal")}>Signal Terminal</p>
            <h1 className="m-0 text-[clamp(30px,3.6vw,38px)] leading-[1.05] font-bold tracking-[-0.04em] text-text">
              Your P&amp;L,
              <br />
              <span className="text-headline-accent">on the grid.</span>
            </h1>
            <p className="mt-4 max-w-[34ch] text-[13px] leading-relaxed text-text-muted">
              Dense stats. Zero clutter. Numbers that glow when they matter.
            </p>
          </div>

          <div className="relative mt-10 grid grid-cols-2 gap-px border border-border bg-border max-[820px]:hidden">
            <div className="bg-bg-panel px-4 py-3.5">
              <span className={labelClass}>Net P&amp;L</span>
              <div className="mt-1.5 text-[22px] font-semibold tracking-tight text-profit hero-glow-profit">
                +$2,847
              </div>
            </div>
            <div className="bg-bg-panel px-4 py-3.5">
              <span className={labelClass}>Win rate</span>
              <div className="mt-1.5 text-[22px] font-semibold tracking-tight text-text">68.4%</div>
            </div>
          </div>
        </aside>

        {/* Auth form panel — fixed shell height; content flows naturally */}
        <section
          className="flex h-full flex-col justify-center overflow-y-auto bg-bg px-8 py-8 max-[820px]:justify-start max-[820px]:px-6 max-[820px]:py-7"
          aria-labelledby={`${formId}-title`}
        >
          <div className="mx-auto flex w-full max-w-[320px] flex-col">
            <header className="mb-6 flex flex-col items-center">
              <AuthModeTabs
                ariaLabel="Authentication mode"
                options={modes}
                value={mode}
                onChange={(v) => switchMode(v as AuthMode)}
              />
            </header>

            {banner && (
              <div
                className="mb-4 flex items-start gap-2 rounded-control border border-[rgba(228,255,26,0.22)] bg-[rgba(228,255,26,0.06)] px-3 py-2.5 text-xs leading-snug text-signal"
                role="status"
              >
                <AlertCircle size={14} strokeWidth={1.5} aria-hidden />
                <span>{banner}</span>
              </div>
            )}

            <form onSubmit={submit} noValidate={false} className="flex flex-col">
              <div className="mb-5">
                <h2
                  id={`${formId}-title`}
                  className="mb-1 text-[17px] font-semibold tracking-tight text-text"
                >
                  {isLogin ? "Welcome back" : "Start your journal"}
                </h2>
                <p className="text-[12px] leading-relaxed text-text-muted">
                  {isLogin
                    ? "Pick up where your last session left off."
                    : "Your trade data stays on your stack."}
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <AuthField
                  label="Username"
                  id="username"
                  type="text"
                  value={email}
                  onChange={setEmail}
                  placeholder="owner"
                  autoComplete="username"
                  autoFocus
                />
                <AuthField
                  label="Password"
                  id="password"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  placeholder={isLogin ? "Your password" : `At least ${MIN_PASSWORD} characters`}
                  hint={
                    isLogin
                      ? undefined
                      : `Use ${MIN_PASSWORD}+ characters with a mix of letters and numbers.`
                  }
                  autoComplete={isLogin ? "current-password" : "new-password"}
                />
              </div>

              {error && (
                <div
                  className="mt-1 flex items-start gap-2 rounded-control border border-[rgba(251,113,133,0.22)] bg-[rgba(251,113,133,0.08)] px-3 py-2.5 text-xs leading-snug text-loss"
                  role="alert"
                >
                  <AlertCircle size={14} strokeWidth={1.5} aria-hidden />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                variant="default"
                size="lg"
                className="group mt-4 h-11 w-full border border-border-strong hover:shadow-[0_0_28px_var(--color-accent-glow)] active:scale-[0.99] disabled:active:scale-100"
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
                {!busy && (
                  <ArrowRight
                    size={14}
                    strokeWidth={2}
                    className="transition-transform duration-150 group-hover:translate-x-0.5"
                    aria-hidden
                  />
                )}
              </Button>

              <div className="mt-4 flex flex-col items-center gap-2">
                <p className="text-[11px] text-text-dim">
                  Press <Kbd>Enter</Kbd> to continue
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAdvancedOpen(true)}
                  className="text-text-muted hover:text-text"
                >
                  <Settings2 size={12} strokeWidth={1.5} aria-hidden />
                  Advanced
                  {serverUrl ? (
                    <span className="max-w-[10rem] truncate text-text-dim" title={serverUrl}>
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
              <div className="flex flex-col gap-1.5">
                <label htmlFor="server-url" className={labelClass}>
                  API server
                </label>
                <SignalInput
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
                  className="h-10 w-full text-[13px]"
                />
                <p className="text-[11px] leading-snug text-text-dim">
                  API host for this device. Leave blank for the default. You only need the origin —{" "}
                  /api/v1 is added automatically.
                </p>
              </div>
            </Modal>
          </div>
        </section>
      </div>
    </div>
  );
}
