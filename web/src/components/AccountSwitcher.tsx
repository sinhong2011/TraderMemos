import { SignalSelect } from "./SignalSelect";
import { useFilters } from "../lib/filters";
import { useAccounts } from "../lib/hooks/useAccounts";

export function AccountSwitcher() {
	const { data: accounts, isLoading } = useAccounts();
	const { accountId, setAccount } = useFilters();

	const items = accounts ?? [];
	const options = [
		{ value: "", label: "All accounts" },
		...items.map((a) => ({ value: a.id, label: a.name })),
	];

	if (isLoading) {
		return (
			<div className="flex h-8 min-w-[120px] items-center rounded-control border border-border bg-bg-hover px-2.5 text-[11px] text-text-muted">
				Loading…
			</div>
		);
	}

	return (
		<div className="flex items-center gap-2">
			<span
				aria-hidden
				className="size-2 shrink-0 rounded-full bg-profit"
			/>
			<SignalSelect
				value={accountId ?? ""}
				onValueChange={(val) => setAccount(val === "" ? undefined : val)}
				options={options}
				ariaLabel="Account"
				triggerClassName="min-w-[120px] font-mono text-[11px] text-text-muted"
			/>
		</div>
	);
}
