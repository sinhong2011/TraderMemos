import { LogOut, PanelLeft, Search } from "lucide-react";
import { useAuth } from "../lib/auth";
import { useFilterParams, useFilters } from "../lib/filters";
import { fmtMoney, fmtSignedMoney } from "../lib/format";
import { computeHeaderStats } from "../lib/headerStats";
import { useAccounts } from "../lib/hooks/useAccounts";
import { useSummary } from "../lib/hooks/useAnalytics";
import { useCash } from "../lib/hooks/useCash";
import { useTrades } from "../lib/hooks/useTrades";
import { useUI } from "../lib/ui";
import { DateRangePicker } from "./DateRangePicker";
import { pnlColor } from "./theme-tokens";

const LOCALE = "en-US";

function SubStat({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex flex-col leading-tight">
			<span
				className="text-[10px] uppercase tracking-wide"
				style={{ color: "var(--color-text-muted)" }}
			>
				{label}
			</span>
			<span
				className="text-[12px] font-medium tabular-nums"
				style={{ color: "var(--color-text)" }}
			>
				{value}
			</span>
		</div>
	);
}

export function HeaderBar() {
	const filters = useFilterParams();
	const accountId = useFilters((s) => s.accountId);
	const symbol = useFilters((s) => s.symbol) ?? "";
	const setSymbol = useFilters((s) => s.setSymbol);
	const signOut = useAuth((s) => s.signOut);
	const toggleSidebar = useUI((s) => s.toggleSidebar);

	const accounts = useAccounts().data ?? [];
	const summaryQ = useSummary(filters);
	const tradesQ = useTrades(filters);
	const cashQ = useCash(filters);

	const currency =
		accounts.find((a) => a.id === accountId)?.base_currency ?? "USD";
	const stats = computeHeaderStats({
		accounts,
		accountId,
		cashTx: cashQ.data ?? [],
		summary: summaryQ.data,
		trades: tradesQ.data ?? [],
	});

	return (
		<header
			className="flex items-center gap-4 px-4 shrink-0"
			style={{
				borderBottom: "1px solid var(--color-border)",
				background: "var(--color-surface-panel)",
				height: "64px",
			}}
		>
			<button
				type="button"
				onClick={toggleSidebar}
				aria-label="Toggle sidebar"
				style={{
					background: "none",
					border: "none",
					cursor: "pointer",
					color: "var(--color-text-muted)",
					display: "flex",
					padding: 4,
				}}
			>
				<PanelLeft size={16} strokeWidth={1.5} />
			</button>

			{/* Account P&L block */}
			<div className="flex items-center gap-4">
				<span
					className={`text-2xl font-bold tabular-nums tracking-tight ${pnlColor(stats.netPnl)}`}
				>
					{fmtSignedMoney(stats.netPnl, currency, LOCALE)}
				</span>
				<SubStat label="Cash" value={fmtMoney(stats.cash, currency, LOCALE)} />
				<SubStat
					label="Active"
					value={fmtMoney(stats.active, currency, LOCALE)}
				/>
			</div>

			<div className="ml-auto flex items-center gap-2">
				{/* Search and filter */}
				<div
					className="flex items-center gap-2 px-3"
					style={{
						background: "var(--color-surface-raised)",
						border: "1px solid var(--color-border)",
						borderRadius: 999,
						height: 32,
						width: 240,
					}}
				>
					<Search
						size={14}
						strokeWidth={1.5}
						style={{ color: "var(--color-text-muted)", flexShrink: 0 }}
					/>
					<input
						value={symbol}
						onChange={(e) =>
							setSymbol(e.target.value.toUpperCase() || undefined)
						}
						placeholder="Search and Filter"
						aria-label="Search symbol"
						style={{
							background: "transparent",
							border: "none",
							outline: "none",
							color: "var(--color-text)",
							fontSize: 12,
							fontFamily: "var(--font-ui)",
							width: "100%",
						}}
					/>
				</div>
				<DateRangePicker />
				<button
					type="button"
					onClick={signOut}
					aria-label="Sign out"
					className="flex items-center justify-center"
					style={{
						width: 30,
						height: 30,
						color: "var(--color-text-muted)",
						background: "transparent",
						border: "1px solid var(--color-border)",
						borderRadius: "var(--radius-control)",
						cursor: "pointer",
					}}
				>
					<LogOut size={14} strokeWidth={1.5} />
				</button>
			</div>
		</header>
	);
}
