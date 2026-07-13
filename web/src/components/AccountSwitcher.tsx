import { SignalSelect } from "./SignalSelect";
import { cn } from "../lib/cn";
import { useFilters } from "../lib/filters";
import { useAccounts } from "../lib/hooks/useAccounts";

export function AccountSwitcher({ className }: { className?: string }) {
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
		<SignalSelect
			value={accountId ?? ""}
			onValueChange={(val) => setAccount(val === "" ? undefined : val)}
			options={options}
			ariaLabel="Account"
			triggerClassName={cn(
				"h-8 min-w-0 font-medium text-[11px] text-text-muted",
				className ?? "min-w-[112px]",
			)}
		/>
	);
}
