import { CandlestickChart } from "lucide-react";
import { useState } from "react";
import { authApi } from "../../lib/api/auth";
import { ApiError } from "../../lib/api/client";
import { useAuth } from "../../lib/auth";

export function LoginScreen() {
	const signIn = useAuth((s) => s.signIn);
	const [mode, setMode] = useState<"login" | "register">("login");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		setBusy(true);
		try {
			if (mode === "register") {
				await authApi.register(email, password);
			}
			const tokens = await authApi.login(email, password);
			signIn(tokens.access_token);
		} catch (err) {
			setError(err instanceof ApiError ? err.message : "Something went wrong");
		} finally {
			setBusy(false);
		}
	}

	const inputStyle: React.CSSProperties = {
		background: "var(--color-surface-hover)",
		color: "var(--color-text)",
		border: "1px solid var(--color-border)",
		borderRadius: "var(--radius-control)",
		padding: "9px 11px",
		fontSize: "13px",
		fontFamily: "var(--font-ui)",
		outline: "none",
		width: "100%",
	};

	return (
		<div
			className="flex h-full items-center justify-center"
			style={{ background: "var(--color-surface-base)" }}
		>
			<div
				style={{
					width: 340,
					background: "var(--color-surface-panel)",
					border: "1px solid var(--color-border)",
					borderRadius: "var(--radius-panel)",
					padding: "28px 24px",
				}}
			>
				<div
					className="flex items-center gap-2 font-semibold"
					style={{ color: "var(--color-text)", marginBottom: 4 }}
				>
					<CandlestickChart
						size={18}
						strokeWidth={2}
						style={{ color: "var(--color-accent)" }}
					/>
					TraderMemos
				</div>
				<div
					className="text-xs"
					style={{ color: "var(--color-text-muted)", marginBottom: 20 }}
				>
					{mode === "login" ? "Sign in to your journal" : "Create your account"}
				</div>

				<form onSubmit={submit} className="flex flex-col gap-3">
					<div className="flex flex-col gap-1">
						<label
							htmlFor="email"
							className="text-[11px] uppercase tracking-wide"
							style={{ color: "var(--color-text-muted)" }}
						>
							Email
						</label>
						<input
							id="email"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							style={inputStyle}
							required
						/>
					</div>
					<div className="flex flex-col gap-1">
						<label
							htmlFor="password"
							className="text-[11px] uppercase tracking-wide"
							style={{ color: "var(--color-text-muted)" }}
						>
							Password
						</label>
						<input
							id="password"
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							style={inputStyle}
							required
						/>
					</div>

					{error && (
						<p className="text-xs" style={{ color: "var(--color-neg)" }}>
							{error}
						</p>
					)}

					<button
						type="submit"
						disabled={busy}
						style={{
							background: "var(--color-accent)",
							color: "#0e1218",
							border: "none",
							borderRadius: "var(--radius-control)",
							padding: "9px 12px",
							fontSize: "13px",
							fontWeight: 600,
							cursor: busy ? "default" : "pointer",
							opacity: busy ? 0.6 : 1,
							marginTop: 4,
						}}
					>
						{busy ? "..." : mode === "login" ? "Sign in" : "Create account"}
					</button>
				</form>

				<button
					type="button"
					onClick={() => {
						setMode(mode === "login" ? "register" : "login");
						setError("");
					}}
					className="text-xs"
					style={{
						color: "var(--color-text-muted)",
						background: "none",
						border: "none",
						cursor: "pointer",
						marginTop: 16,
					}}
				>
					{mode === "login"
						? "No account? Create one"
						: "Have an account? Sign in"}
				</button>
			</div>
		</div>
	);
}
