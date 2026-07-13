import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../lib/cn";
import { intlLocale } from "../lib/locale";
import { SignalPopover } from "./SignalPopover";
import { SignalSelect } from "./SignalSelect";

function navBtnClass(disabled?: boolean) {
	return cn(
		"flex size-7 shrink-0 items-center justify-center rounded-control border border-border bg-transparent text-text-muted",
		"transition-colors hover:border-border-strong hover:bg-bg-hover hover:text-text",
		"focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
		disabled && "pointer-events-none opacity-35",
	);
}

/** Sidebar shortcut styled like the DateRangePanel presets. */
function QuickJump({
	active,
	onClick,
	children,
}: {
	active?: boolean;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"relative w-full cursor-pointer rounded-control py-2 pr-2 pl-2.5 text-left text-[11px] outline-none",
				"transition-colors duration-100",
				"focus-visible:ring-2 focus-visible:ring-accent/40",
				active
					? "bg-bg-hover text-text"
					: "text-text-muted hover:bg-bg-hover hover:text-text",
			)}
		>
			{active && (
				<span
					aria-hidden
					className="absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent"
				/>
			)}
			{children}
		</button>
	);
}

function formatMonthYear(date: Date): string {
	return date.toLocaleDateString(intlLocale(), {
		month: "long",
		year: "numeric",
	});
}

function monthLabels(kind: "short" | "long"): string[] {
	const locale = intlLocale();
	return Array.from({ length: 12 }, (_, i) =>
		new Date(2000, i, 1).toLocaleDateString(locale, { month: kind }),
	);
}

export function MonthPicker({
	year,
	month,
	onPrevMonth,
	onNextMonth,
	onToday,
	onJumpToMonth,
	canGoNext = true,
}: {
	year: number;
	month: number;
	onPrevMonth: () => void;
	onNextMonth: () => void;
	onToday: () => void;
	onJumpToMonth: (year: number, month: number) => void;
	canGoNext?: boolean;
}) {
	const [open, setOpen] = useState(false);
	const [pickerYear, setPickerYear] = useState(year);
	const now = new Date();

	useEffect(() => {
		if (open) setPickerYear(year);
	}, [open, year]);

	const monthLabel = formatMonthYear(new Date(year, month - 1, 1));
	const shortMonths = monthLabels("short");
	const longMonths = monthLabels("long");

	const maxYear = now.getFullYear();
	const minYear = Math.min(maxYear - 10, pickerYear, year);
	const yearOptions = Array.from({ length: maxYear - minYear + 1 }, (_, i) => {
		const y = maxYear - i;
		return { value: String(y), label: String(y) };
	});

	const isThisMonth =
		year === now.getFullYear() && month === now.getMonth() + 1;
	const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
	const isLastMonth =
		year === lastMonth.getFullYear() && month === lastMonth.getMonth() + 1;

	function jump(y: number, m: number) {
		onJumpToMonth(y, m);
		setOpen(false);
	}

	function applyQuick(offsetMonths: number) {
		const d = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1);
		jump(d.getFullYear(), d.getMonth() + 1);
	}

	return (
		<div className="flex items-center gap-2">
			<button
				type="button"
				onClick={onPrevMonth}
				aria-label="Previous month"
				className={navBtnClass()}
			>
				<ChevronLeft size={14} strokeWidth={1.5} />
			</button>

			<SignalPopover
				open={open}
				onOpenChange={setOpen}
				align="start"
				triggerAriaLabel={`${monthLabel}, choose month`}
				className="overflow-hidden p-0"
				triggerClassName={cn(
					"h-7 min-w-[9.5rem] rounded-control border border-border bg-transparent px-2.5",
					"text-[13px] font-semibold tabular-nums text-text",
					"transition-[border-color,background-color,box-shadow] duration-150",
					"hover:border-border-strong hover:bg-bg-hover",
					open && "border-accent shadow-[0_0_0_3px_var(--color-accent-bg)]",
				)}
				trigger={
					<>
						<span className="min-w-0 flex-1 truncate text-left">
							{monthLabel}
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
				<div
					className="flex w-[320px] max-w-[calc(100vw-2rem)]"
					aria-label="Choose month"
				>
					<aside className="flex w-[116px] shrink-0 flex-col bg-bg">
						<p className="m-0 px-3 pt-3 pb-2 text-[11px] font-medium uppercase tracking-widest text-text-muted">
							Quick jump
						</p>
						<div className="flex flex-col gap-0.5 px-2 pb-3">
							<QuickJump active={isThisMonth} onClick={() => applyQuick(0)}>
								This month
							</QuickJump>
							<QuickJump active={isLastMonth} onClick={() => applyQuick(-1)}>
								Last month
							</QuickJump>
						</div>
					</aside>

					<div className="flex min-w-0 flex-1 flex-col bg-bg-panel px-3 pt-3 pb-3">
						<div className="mb-2 flex items-center justify-between">
							<button
								type="button"
								onClick={() => setPickerYear((y) => y - 1)}
								aria-label="Previous year"
								className={navBtnClass()}
							>
								<ChevronLeft size={14} strokeWidth={1.5} />
							</button>
							<SignalSelect
								value={String(pickerYear)}
								onValueChange={(v) => setPickerYear(Number(v))}
								options={yearOptions}
								ariaLabel="Choose year"
								ghost
								className="w-auto"
								triggerClassName="h-7 w-auto gap-1.5 px-2.5 text-[12px] font-semibold tabular-nums"
							/>
							<button
								type="button"
								onClick={() => setPickerYear((y) => y + 1)}
								disabled={pickerYear >= now.getFullYear()}
								aria-label="Next year"
								className={navBtnClass(pickerYear >= now.getFullYear())}
							>
								<ChevronRight size={14} strokeWidth={1.5} />
							</button>
						</div>

						<div className="grid grid-cols-3 gap-1">
							{shortMonths.map((label, i) => {
								const m = i + 1;
								const isActive = pickerYear === year && m === month;
								const isCurrent =
									pickerYear === now.getFullYear() && i === now.getMonth();
								const isFuture =
									pickerYear === now.getFullYear() && i > now.getMonth();
								return (
									<button
										key={label}
										type="button"
										onClick={() => jump(pickerYear, m)}
										disabled={isFuture}
										aria-label={`${longMonths[i]} ${pickerYear}`}
										aria-pressed={isActive}
										className={cn(
											"h-9 rounded-control text-[11px] font-medium capitalize transition-colors",
											"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
											isActive
												? "bg-accent font-semibold text-bg"
												: "text-text hover:bg-bg-hover",
											!isActive &&
												isCurrent &&
												"text-signal ring-1 ring-signal/40 ring-inset",
											isFuture && "cursor-not-allowed opacity-30",
										)}
									>
										{label}
									</button>
								);
							})}
						</div>
					</div>
				</div>
			</SignalPopover>

			<button
				type="button"
				onClick={onNextMonth}
				disabled={!canGoNext}
				aria-label="Next month"
				className={navBtnClass(!canGoNext)}
			>
				<ChevronRight size={14} strokeWidth={1.5} />
			</button>

			<button
				type="button"
				onClick={onToday}
				disabled={isThisMonth}
				className={cn(
					navBtnClass(isThisMonth),
					"h-7 w-auto px-2.5 text-[12px] font-medium",
				)}
			>
				Today
			</button>
		</div>
	);
}
