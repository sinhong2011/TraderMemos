import { LogOut, Search } from "lucide-react";
import { AccountSwitcher } from "./AccountSwitcher";
import { DateRangePicker } from "./DateRangePicker";
import { heroPnlClass } from "./theme-tokens";
import { useAuth } from "../lib/auth";
import { useFilterParams, useFilters } from "../lib/filters";
import { fmtMoney, fmtPct, fmtSignedMoney } from "../lib/format";
import { computeHeaderStats } from "../lib/headerStats";
import { useAccounts } from "../lib/hooks/useAccounts";
import { useSummary } from "../lib/hooks/useAnalytics";
import { useCash } from "../lib/hooks/useCash";
import { useTrades } from "../lib/hooks/useTrades";

const LOCALE = "en-US";

export function HeaderBar() {
	const filters = useFilterParams();
	const accountId = useFilters((s) => s.accountId);
	const symbol = useFilters((s) => s.symbol) ?? "";
	const setSymbol = useFilters((s) => s.setSymbol);
	const signOut = useAuth((s) => s.signOut);

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
	const summary = summaryQ.data;

	return (
		<header className="flex h-[52px] shrink-0 items-center gap-4 border-b border-border bg-bg-elevated px-4">
			<div className="flex min-w-0 items-center gap-3.5">
				<div className={heroPnlClass(stats.netPnl)}>
					{fmtSignedMoney(stats.netPnl, currency, LOCALE)}
				</div>
				<div className="flex flex-wrap items-center gap-1.5">
					<span className="rounded-sharp border border-border px-2 py-1 font-mono text-[11px] text-text-muted">
						WR {summary ? fmtPct(summary.win_rate, LOCALE) : "—"}
					</span>
					<span className="rounded-sharp border border-border px-2 py-1 font-mono text-[11px] text-text-muted">
						PF{" "}
						{summary?.profit_factor != null
							? summary.profit_factor.toFixed(2)
							: "—"}
					</span>
					<span className="rounded-sharp border border-border px-2 py-1 font-mono text-[11px] text-text-muted">
						Cash {fmtMoney(stats.cash, currency, LOCALE)}
					</span>
				</div>
			</div>

			<div className="ml-auto flex min-w-0 items-center gap-2">
				<div className="flex h-9 min-w-[200px] max-w-[280px] items-center gap-2 rounded-control border border-border bg-bg-inset px-2.5 text-text-dim">
					<Search size={16} strokeWidth={1.75} aria-hidden />
					<input
						value={symbol}
						onChange={(e) =>
							setSymbol(e.target.value.toUpperCase() || undefined)
						}
						placeholder="Filter symbol…"
						aria-label="Search symbol"
						className="min-w-0 flex-1 border-none bg-transparent text-[13px] text-text outline-none placeholder:text-text-dim"
					/>
					<kbd className="rounded-sharp border border-border bg-[rgba(228,255,26,0.06)] px-1.5 py-0.5 font-mono text-[11px] leading-none text-signal">
						⌘K
					</kbd>
				</div>
				<AccountSwitcher />
				<DateRangePicker />
				<button
					type="button"
					onClick={signOut}
					aria-label="Sign out"
					className="flex size-9 cursor-pointer items-center justify-center rounded-control border border-border text-text-muted transition-colors hover:bg-bg-hover hover:text-text"
				>
					<LogOut size={16} strokeWidth={1.75} />
				</button>
			</div>
		</header>
	);
}
