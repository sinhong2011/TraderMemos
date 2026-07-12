import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useFilters } from "../../lib/filters";
import { useAccounts } from "../../lib/hooks/useAccounts";
import { useRiskRules } from "../../lib/hooks/useRiskRules";
import { positionSizeFromRisk } from "../../lib/positionSize";
import { Modal } from "../Modal";

const labelClass =
	"mb-1 block text-[10px] font-medium uppercase tracking-widest text-text-dim";
const inputClass =
	"w-full rounded-control border border-border bg-bg-inset px-2.5 py-2 text-xs text-text outline-none placeholder:text-text-dim";

export function PositionSizeModal({
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
					<p className="m-0 text-[10px] font-medium uppercase tracking-widest text-text-dim">
						Suggested size
					</p>
					<p className="mt-1 mb-0 text-2xl tabular-nums text-text">
						{result.qty} shares
					</p>
					<p className="mt-1 mb-0 text-[11px] text-text-muted">
						Risk ${result.riskDollars.toFixed(2)} · $
						{result.perShareRisk.toFixed(2)} / share
					</p>
				</div>
			) : (
				<p className="m-0 text-xs text-text-dim">
					Enter equity, risk %, entry, and stop to see size.
				</p>
			)}
			<Link
				to="/calculator"
				onClick={() => onOpenChange(false)}
				className="mt-1 inline-flex text-[11px] font-medium text-accent no-underline transition-colors hover:text-text"
			>
				Open full planner — exit ladder &amp; R-axis →
			</Link>
		</Modal>
	);
}
