import {
	Calculator,
	CalendarDays,
	ChartLine,
	Flame,
	Globe,
	LayoutGrid,
	RefreshCw,
	Scale,
	TrendingUp,
	Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "../lib/cn";
import { useFilters } from "../lib/filters";
import { useAccounts } from "../lib/hooks/useAccounts";
import { useRiskRules } from "../lib/hooks/useRiskRules";
import { positionSizeFromRisk } from "../lib/positionSize";
import { Modal } from "./Modal";
import { useToastManager } from "./Toast";

type ToolItem = {
	id: string;
	label: string;
	icon: LucideIcon;
};

const TOOLS: ToolItem[] = [
	{ id: "size", label: "Position size", icon: Calculator },
	{ id: "planner", label: "Trade planner", icon: LayoutGrid },
	{ id: "kelly", label: "Kelly criterion", icon: Scale },
	{ id: "fx", label: "Currency converter", icon: RefreshCw },
	{ id: "today", label: "Today", icon: CalendarDays },
	{ id: "chart", label: "Advanced chart", icon: ChartLine },
	{ id: "econ", label: "Economic calendar", icon: Globe },
	{ id: "rating", label: "Technical rating", icon: TrendingUp },
	{ id: "heatmap", label: "Heatmap", icon: Flame },
];

const labelClass =
	"mb-1 block font-mono text-[10px] font-medium uppercase tracking-widest text-text-dim";
const inputClass =
	"w-full rounded-control border border-border bg-bg-inset px-2.5 py-2 font-mono text-xs text-text outline-none placeholder:text-text-dim";

function RailTooltip({ label }: { label: string }) {
	return (
		<span
			className={cn(
				"pointer-events-none absolute top-1/2 left-[calc(100%+6px)] z-50",
				"-translate-y-1/2 translate-x-1",
				"rounded-control border border-border bg-bg-panel px-2 py-1",
				"font-mono text-[11px] tracking-wide whitespace-nowrap text-text-muted",
				"opacity-0 transition-[opacity,transform] duration-150 ease-out",
				"group-hover:translate-x-0 group-hover:opacity-100",
			)}
		>
			{label}
		</span>
	);
}

function PositionSizeModal({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const accountId = useFilters((s) => s.accountId);
	const accounts = useAccounts().data ?? [];
	const account = accounts.find((a) => a.id === accountId) ?? accounts[0];
	const riskRules = useRiskRules().data;
	const defaultPct = riskRules?.default_account_risk_pct ?? 1;

	const [equity, setEquity] = useState("10000");
	const [riskPct, setRiskPct] = useState("1");
	const [entry, setEntry] = useState("");
	const [stop, setStop] = useState("");

	useEffect(() => {
		if (account) setEquity(String(account.starting_balance));
	}, [account]);

	useEffect(() => {
		if (defaultPct != null) setRiskPct(String(defaultPct));
	}, [defaultPct]);

	const result = useMemo(() => {
		const eq = Number(equity);
		const pct = Number(riskPct);
		const en = Number(entry);
		const st = Number(stop);
		if (![eq, pct, en, st].every((n) => Number.isFinite(n))) return null;
		return positionSizeFromRisk({
			equity: eq,
			riskPct: pct,
			entryPrice: en,
			stopPrice: st,
		});
	}, [equity, riskPct, entry, stop]);

	return (
		<Modal
			open={open}
			onOpenChange={onOpenChange}
			title="Position size"
			className="max-w-[420px]"
		>
			<p className="m-0 text-xs leading-relaxed text-text-muted">
				Size from account equity, risk %, entry, and stop. Uses your default
				risk % from Settings when available.
			</p>
			<div className="grid grid-cols-2 gap-3">
				<div>
					<label className={labelClass} htmlFor="ps-equity">
						Equity ($)
					</label>
					<input
						id="ps-equity"
						className={inputClass}
						inputMode="decimal"
						value={equity}
						onChange={(e) => setEquity(e.target.value)}
					/>
				</div>
				<div>
					<label className={labelClass} htmlFor="ps-pct">
						Risk %
					</label>
					<input
						id="ps-pct"
						className={inputClass}
						inputMode="decimal"
						value={riskPct}
						onChange={(e) => setRiskPct(e.target.value)}
					/>
				</div>
				<div>
					<label className={labelClass} htmlFor="ps-entry">
						Entry
					</label>
					<input
						id="ps-entry"
						className={inputClass}
						inputMode="decimal"
						value={entry}
						onChange={(e) => setEntry(e.target.value)}
						placeholder="100"
					/>
				</div>
				<div>
					<label className={labelClass} htmlFor="ps-stop">
						Stop
					</label>
					<input
						id="ps-stop"
						className={inputClass}
						inputMode="decimal"
						value={stop}
						onChange={(e) => setStop(e.target.value)}
						placeholder="99"
					/>
				</div>
			</div>
			{result ? (
				<div className="rounded-panel border border-border bg-bg-inset px-3.5 py-3">
					<p className="m-0 font-mono text-[10px] font-medium uppercase tracking-widest text-text-dim">
						Suggested size
					</p>
					<p className="mt-1 mb-0 font-mono text-2xl tabular-nums text-text">
						{result.qty} shares
					</p>
					<p className="mt-1 mb-0 font-mono text-[11px] text-text-muted">
						Risk ${result.riskDollars.toFixed(2)} · ${result.perShareRisk.toFixed(2)}{" "}
						/ share
					</p>
				</div>
			) : (
				<p className="m-0 text-xs text-text-dim">
					Enter equity, risk %, entry, and stop to see size.
				</p>
			)}
		</Modal>
	);
}

export function ToolboxRail() {
	const toast = useToastManager();
	const [sizeOpen, setSizeOpen] = useState(false);

	return (
		<>
			<aside
				aria-label="Toolbox"
				className="flex w-[52px] shrink-0 flex-col items-center gap-1 border-r border-border bg-bg-elevated py-2"
			>
				<div
					className="mb-1 flex size-8 items-center justify-center rounded-sharp font-mono text-[11px] font-semibold text-signal"
					title="Toolbox"
				>
					TB
				</div>
				{TOOLS.map((tool) => {
					const Icon = tool.icon;
					return (
						<button
							key={tool.id}
							type="button"
							title={tool.label}
							aria-label={tool.label}
							onClick={() => {
								if (tool.id === "size") {
									setSizeOpen(true);
									return;
								}
								toast.add({
									title: tool.label,
									description: "Coming soon in TraderMemos.",
								});
							}}
							className={cn(
								"group relative flex size-9 cursor-pointer items-center justify-center rounded-control",
								"text-text-dim transition-colors hover:bg-bg-hover hover:text-text",
							)}
						>
							<Icon size={18} strokeWidth={1.75} />
							<RailTooltip label={tool.label} />
						</button>
					);
				})}
				<div className="mt-auto">
					<button
						type="button"
						title="Wallet"
						aria-label="Wallet"
						onClick={() =>
							toast.add({
								title: "Wallet",
								description: "Account cash view is in the header.",
							})
						}
						className="group relative flex size-9 cursor-pointer items-center justify-center rounded-control text-text-dim transition-colors hover:bg-bg-hover hover:text-text"
					>
						<Wallet size={18} strokeWidth={1.75} />
						<RailTooltip label="Wallet" />
					</button>
				</div>
			</aside>
			<PositionSizeModal open={sizeOpen} onOpenChange={setSizeOpen} />
		</>
	);
}
