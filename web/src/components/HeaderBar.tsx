import { Search, X } from "lucide-react";
import { AccountSwitcher } from "./AccountSwitcher";
import { DateRangePicker } from "./DateRangePicker";
import { ToolsPopover } from "./ToolsPopover";
import { heroPnlClass } from "./theme-tokens";
import { cn } from "../lib/cn";
import { useFilterParams, useFilters } from "../lib/filters";
import { fmtMoney, fmtPct, fmtSignedMoney } from "../lib/format";
import { computeHeaderStats } from "../lib/headerStats";
import { useAccounts } from "../lib/hooks/useAccounts";
import { useSummary } from "../lib/hooks/useAnalytics";
import { useCash } from "../lib/hooks/useCash";
import { useTrades } from "../lib/hooks/useTrades";
import { useUI } from "../lib/ui";
import { intlLocale } from "../lib/locale";

function HeaderStat({ label, value }: { label: string; value: string }) {
	return (
		<span className="inline-flex items-baseline gap-1 text-[13px] font-medium whitespace-nowrap">
			<span className="uppercase tracking-widest text-text-muted">{label}</span>
			<span className="font-semibold tabular-nums text-text">{value}</span>
		</span>
	);
}

function StatDivider() {
	return <span aria-hidden className="text-[13px] text-text-muted/50 select-none">·</span>;
}

function SymbolFilterChip({
	symbol,
	onClear,
}: {
	symbol: string;
	onClear: () => void;
}) {
	return (
		<span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-control border border-accent/25 bg-accent-bg px-2 text-[11px] text-accent">
			{symbol}
			<button
				type="button"
				onClick={onClear}
				aria-label="Clear symbol filter"
				className="flex cursor-pointer items-center justify-center rounded-sharp p-0.5 text-accent/70 transition-colors hover:bg-accent/10 hover:text-accent"
			>
				<X size={12} strokeWidth={2} />
			</button>
		</span>
	);
}

export function HeaderBar() {
	const filters = useFilterParams();
	const accountId = useFilters((s) => s.accountId);
	const symbol = useFilters((s) => s.symbol);
	const setSymbol = useFilters((s) => s.setSymbol);
	const openCommandPalette = useUI((s) => s.openCommandPalette);

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
		<header className="grid h-[52px] shrink-0 grid-cols-[minmax(0,auto)_minmax(0,1fr)_auto] items-center gap-3 bg-bg px-4">
			{/* Performance strip */}
			<div className="flex min-w-0 items-center gap-3">
				<div className={cn(heroPnlClass(stats.netPnl), "shrink-0 text-[28px]")}>
					{fmtSignedMoney(stats.netPnl, currency, intlLocale())}
				</div>
				<div
					aria-hidden
					className="hidden h-7 w-px shrink-0 bg-border sm:block"
				/>
				<div className="hidden min-w-0 items-center gap-2 sm:flex">
					<HeaderStat
						label="WR"
						value={summary ? fmtPct(summary.win_rate, intlLocale()) : "—"}
					/>
					<StatDivider />
					<HeaderStat
						label="PF"
						value={
							summary?.profit_factor != null
								? summary.profit_factor.toFixed(2)
								: "—"
						}
					/>
					<StatDivider />
					<HeaderStat
						label="Cash"
						value={fmtMoney(stats.cash, currency, intlLocale())}
					/>
				</div>
			</div>

			{/* Command search — single entry point */}
			<div className="flex min-w-0 items-center justify-end gap-2 px-1">
				{symbol ? (
					<SymbolFilterChip
						symbol={symbol}
						onClear={() => setSymbol(undefined)}
					/>
				) : null}
				<button
					type="button"
					onClick={openCommandPalette}
					className={cn(
						"flex h-8 max-w-[200px] min-w-[80px] shrink-0 cursor-pointer items-center gap-2 rounded-control",
						"border border-border bg-bg-inset/60 px-3",
						"text-[12px] font-medium text-text-dim",
						"transition-[border-color,background-color,color] duration-150",
						"hover:border-border-strong hover:bg-bg-hover hover:text-text-muted",
						"focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
					)}
				>
					<Search size={14} strokeWidth={1.75} aria-hidden />
					<span className="min-w-0 flex-1 truncate text-left">
						Jump to page or tool…
					</span>
					<kbd className="hidden shrink-0 rounded-sharp border border-border bg-[rgba(228,255,26,0.06)] px-1.5 py-0.5 text-[10px] leading-none text-signal sm:inline">
						⌘K
					</kbd>
				</button>
			</div>

			{/* Global filters */}
			<div className="flex shrink-0 items-center gap-1.5">
				<AccountSwitcher className="h-8 min-w-[7.5rem] text-[11px]" />
				<DateRangePicker />
				<ToolsPopover variant="header" />
			</div>
		</header>
	);
}
