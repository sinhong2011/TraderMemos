import { format } from "date-fns";
import { CalendarDays, ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "../lib/cn";
import { localDateString, parseFilterDay } from "../lib/dateRangePresets";
import { SignalCalendar } from "./SignalCalendar";
import { SignalPopover } from "./SignalPopover";

export function SignalDatePicker({
	id,
	value,
	onChange,
	onBlur,
	disabled,
	placeholder = "Pick date",
	className,
	"aria-label": ariaLabel,
}: {
	id?: string;
	/** YYYY-MM-DD in local calendar terms */
	value?: string;
	onChange: (value: string) => void;
	onBlur?: () => void;
	disabled?: boolean;
	placeholder?: string;
	className?: string;
	"aria-label"?: string;
}) {
	const [open, setOpen] = useState(false);
	const selected = value ? parseFilterDay(`${value}T00:00:00Z`) : undefined;
	const label = selected ? format(selected, "MMM d, yyyy") : placeholder;
	const now = new Date();
	const minYear = Math.min(
		now.getFullYear() - 10,
		selected?.getFullYear() ?? Number.POSITIVE_INFINITY,
	);

	return (
		<SignalPopover
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) onBlur?.();
			}}
			triggerAriaLabel={ariaLabel}
			align="start"
			triggerClassName={cn(
				"h-8 w-full rounded-control border border-border bg-bg-inset px-2.5",
				"transition-[border-color,background-color,box-shadow] duration-150",
				"hover:border-border-strong focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_var(--color-accent-bg)]",
				disabled && "cursor-not-allowed opacity-55",
				open && "border-accent shadow-[0_0_0_3px_var(--color-accent-bg)]",
				className,
			)}
			trigger={
				<>
					<CalendarDays
						size={13}
						strokeWidth={1.5}
						className="shrink-0 text-text-dim"
						aria-hidden
					/>
					<span
						id={id}
						className={cn(
							"min-w-0 flex-1 truncate text-left text-[11px]",
							selected ? "text-text" : "text-text-dim",
						)}
					>
						{label}
					</span>
					<ChevronDown
						size={12}
						strokeWidth={1.5}
						className={cn(
							"shrink-0 text-text-dim transition-transform duration-150",
							open && "rotate-180",
						)}
						aria-hidden
					/>
				</>
			}
		>
			<div className="p-3">
				<SignalCalendar
					mode="single"
					selected={selected}
					onSelect={(day) => {
						if (day) {
							onChange(localDateString(day));
							setOpen(false);
							onBlur?.();
						}
					}}
					defaultMonth={selected ?? now}
					disabled={{ after: now }}
					captionLayout="dropdown"
					startMonth={new Date(minYear, 0)}
					endMonth={now}
					className="p-0"
				/>
			</div>
		</SignalPopover>
	);
}
