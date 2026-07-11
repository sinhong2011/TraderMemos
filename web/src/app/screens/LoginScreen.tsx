import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, Mail, Zap } from "lucide-react";
import { useId, useState } from "react";
import { AuthModeTabs } from "../../components/AuthModeTabs";
import { authApi } from "../../lib/api/auth";
import { ApiError } from "../../lib/api/client";
import { useAuth } from "../../lib/auth";
import { cn } from "../../lib/cn";
import { DEV_ACCOUNT, isDevAuthEnabled } from "../../lib/devAccount";

const MODES = [
	{ value: "login", label: "Sign in" },
	{ value: "register", label: "Create account" },
] as const;

type AuthMode = (typeof MODES)[number]["value"];

const labelClass =
	"font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-text-dim";

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
}: {
	label: string;
	id: string;
	type: "email" | "password" | "text";
	value: string;
	onChange: (v: string) => void;
	placeholder?: string;
	hint?: string;
	autoComplete?: string;
	autoFocus?: boolean;
}) {
	const [showPassword, setShowPassword] = useState(false);
	const isPassword = type === "password";
	const inputType = isPassword && showPassword ? "text" : type;
	const Icon = type === "email" ? Mail : Lock;

	return (
		<div className="flex flex-col gap-1.5">
			<label htmlFor={id} className={labelClass}>
				{label}
			</label>
			<div className="group relative flex items-center">
				<Icon
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
						"h-11 w-full rounded-control border border-border bg-bg-inset py-0 pl-10 text-[13px] text-text outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-text-dim hover:border-border-strong focus:border-accent focus:bg-bg-elevated focus:shadow-[0_0_0_3px_var(--color-accent-bg)]",
						isPassword ? "pr-10" : "pr-3",
					)}
					placeholder={placeholder}
					autoComplete={autoComplete}
					autoFocus={autoFocus}
					required
				/>
				{isPassword && (
					<button
						type="button"
						className="absolute right-1.5 flex size-8 cursor-pointer items-center justify-center rounded-sharp border-none bg-transparent text-text-dim transition-colors hover:bg-bg-hover hover:text-text-muted"
						onClick={() => setShowPassword((v) => !v)}
						aria-label={showPassword ? "Hide password" : "Show password"}
					>
						{showPassword ? (
							<EyeOff size={15} strokeWidth={1.5} />
						) : (
							<Eye size={15} strokeWidth={1.5} />
						)}
					</button>
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

export function LoginScreen() {
	const signIn = useAuth((s) => s.signIn);
	const formId = useId();
	const devAuth = isDevAuthEnabled();

	const [mode, setMode] = useState<AuthMode>("login");
	const [email, setEmail] = useState(() => (devAuth ? DEV_ACCOUNT.email : ""));
	const [password, setPassword] = useState(() =>
		devAuth ? DEV_ACCOUNT.password : "",
	);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);

	async function completeSignIn(
		loginEmail: string,
		loginPassword: string,
		asRegister = mode === "register",
	) {
		setError("");
		setBusy(true);
		try {
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
		if (next === "login" && devAuth) {
			setEmail(DEV_ACCOUNT.email);
			setPassword(DEV_ACCOUNT.password);
		} else {
			setPassword("");
			if (next === "register") {
				setEmail("");
			}
		}
	}

	async function signInWithDevAccount() {
		setMode("login");
		setEmail(DEV_ACCOUNT.email);
		setPassword(DEV_ACCOUNT.password);
		await completeSignIn(DEV_ACCOUNT.email, DEV_ACCOUNT.password, false);
	}

	const isLogin = mode === "login";

	return (
		<div className="signal-app relative flex min-h-full items-center justify-center p-6 max-[820px]:items-start max-[820px]:p-4">
			<div className="signal-app-grain" aria-hidden />

			<div className="relative z-[1] grid h-[min(580px,calc(100vh-48px))] w-full max-w-[920px] grid-cols-[1fr_400px] overflow-hidden border border-border-strong bg-bg shadow-hard max-[820px]:h-auto max-[820px]:grid-cols-1">
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
							<span className="flex size-8 items-center justify-center rounded-sharp border border-border-strong bg-accent-bg font-mono text-[11px] font-semibold text-accent shadow-[0_0_20px_var(--color-accent-glow)]">
								TM
							</span>
							<span className="text-[13px] font-medium tracking-tight text-text">
								TraderMemos
							</span>
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
							<div className="mt-1.5 font-mono text-[22px] font-semibold tracking-tight text-profit hero-glow-profit">
								+$2,847
							</div>
						</div>
						<div className="bg-bg-panel px-4 py-3.5">
							<span className={labelClass}>Win rate</span>
							<div className="mt-1.5 font-mono text-[22px] font-semibold tracking-tight text-text">
								68.4%
							</div>
						</div>
					</div>
				</aside>

				{/* Auth form panel — fixed shell height; content flows naturally */}
				<section
					className="flex h-full flex-col justify-center bg-bg px-8 py-8 max-[820px]:justify-start max-[820px]:px-6 max-[820px]:py-7"
					aria-labelledby={`${formId}-title`}
				>
					<div className="mx-auto flex w-full max-w-[320px] flex-col">
						<header className="mb-6 flex flex-col items-center gap-4">
							<div
								className="flex size-9 items-center justify-center rounded-sharp border border-border-strong bg-accent-bg font-mono text-[11px] font-semibold text-accent shadow-[0_0_20px_var(--color-accent-glow)]"
								aria-hidden
							>
								TM
							</div>
							<AuthModeTabs
								ariaLabel="Authentication mode"
								options={MODES}
								value={mode}
								onChange={(v) => switchMode(v as AuthMode)}
							/>
						</header>

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
									label="Email"
									id="email"
									type="email"
									value={email}
									onChange={setEmail}
									placeholder="you@example.com"
									autoComplete="email"
									autoFocus
								/>
								<AuthField
									label="Password"
									id="password"
									type="password"
									value={password}
									onChange={setPassword}
									placeholder={
										isLogin ? "Your password" : "At least 8 characters"
									}
									hint={
										isLogin
											? undefined
											: "Use 8+ characters with a mix of letters and numbers."
									}
									autoComplete={
										isLogin ? "current-password" : "new-password"
									}
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

							<button
								type="submit"
								className="group mt-4 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-control border border-border-strong bg-accent px-4 text-[13px] leading-none font-semibold text-bg transition-[opacity,box-shadow,transform] duration-150 hover:shadow-[0_0_28px_var(--color-accent-glow)] active:scale-[0.99] disabled:cursor-default disabled:opacity-55 disabled:active:scale-100"
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
							</button>

							<div className="mt-4 flex h-8 items-center justify-center">
								{devAuth && isLogin ? (
									<button
										type="button"
										onClick={signInWithDevAccount}
										disabled={busy}
										className="inline-flex cursor-pointer items-center gap-1.5 rounded-sharp border border-dashed border-[rgba(228,255,26,0.28)] bg-[rgba(228,255,26,0.04)] px-2.5 py-1 text-[11px] font-medium text-signal transition-colors hover:border-[rgba(228,255,26,0.45)] hover:bg-[rgba(228,255,26,0.08)] disabled:cursor-default disabled:opacity-55"
									>
										<Zap size={12} strokeWidth={1.5} aria-hidden />
										<span className="font-mono">{DEV_ACCOUNT.email}</span>
										<span className="text-text-dim">·</span>
										<span>Dev sign-in</span>
									</button>
								) : (
									<p className="text-[11px] text-text-dim">
										Press{" "}
										<kbd className="rounded-sharp border border-border bg-[rgba(228,255,26,0.06)] px-1.5 py-0.5 font-mono text-[10px] text-signal">
											Enter
										</kbd>{" "}
										to continue
									</p>
								)}
							</div>
						</form>
					</div>
				</section>
			</div>
		</div>
	);
}
