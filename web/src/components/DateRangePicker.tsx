import { CalendarDays, ChevronDown } from "lucide-react";
import { useState } from "react";
import { formatRangeLabel } from "../lib/dateRangePresets";
import { useFilters } from "../lib/filters";
import { cn } from "../lib/cn";
import { DateRangePanel } from "./DateRangePanel";
import { SignalPopover } from "./SignalPopover";

export function DateRangePicker() {
	const { from, to } = useFilters();
	const [open, setOpen] = useState(false);
	const label = formatRangeLabel(from, to);

	return (
		<SignalPopover
			open={open}
			onOpenChange={setOpen}
			align="end"
			triggerAriaLabel="Date range"
			className="overflow-hidden p-0"
			triggerClassName={cn(
				"h-8 min-w-[112px] rounded-control border border-border bg-bg-inset px-2.5",
				"text-left transition-[border-color,background-color,box-shadow] duration-150",
				"hover:border-border-strong focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_var(--color-accent-bg)]",
				open && "border-accent shadow-[0_0_0_3px_var(--color-accent-bg)]",
			)}
			trigger={
				<>
					<CalendarDays
						size={13}
						strokeWidth={1.75}
						className="shrink-0 text-text-dim"
						aria-hidden
					/>
					<span className="min-w-0 flex-1 truncate text-[11px] font-medium text-text-muted">
						{label}
					</span>
					<ChevronDown
						size={12}
						strokeWidth={1.75}
						className={cn(
							"shrink-0 text-text-dim transition-transform duration-150",
							open && "rotate-180",
						)}
						aria-hidden
					/>
				</>
			}
		>
			<DateRangePanel onApplied={() => setOpen(false)} />
		</SignalPopover>
	);
}
