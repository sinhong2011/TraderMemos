import { format } from "date-fns";
import { useEffect, useState } from "react";
import type { DateRange } from "react-day-picker";
import {
	computePresetRange,
	localDateString,
	parseFilterDay,
	PRESET_LABELS,
	presetFromRange,
	type DateRangePreset,
} from "../lib/dateRangePresets";
import { useFilters } from "../lib/filters";
import { cn } from "../lib/cn";
import { SignalCalendar } from "./SignalCalendar";

const PRESETS: { key: DateRangePreset; label: string }[] = [
	{ key: "7d", label: PRESET_LABELS["7d"] },
	{ key: "30d", label: PRESET_LABELS["30d"] },
	{ key: "90d", label: PRESET_LABELS["90d"] },
	{ key: "month", label: PRESET_LABELS.month },
	{ key: "all", label: PRESET_LABELS.all },
];

function toDraft(from?: string, to?: string): DateRange | undefined {
	const fromDate = parseFilterDay(from);
	const toDate = parseFilterDay(to);
	if (!fromDate && !toDate) return undefined;
	return { from: fromDate, to: toDate };
}

function RangeFooter({ draft }: { draft: DateRange | undefined }) {
	if (draft?.from && !draft.to) {
		return (
			<p className="m-0 text-[10px] uppercase tracking-widest text-signal">
				Select end date
			</p>
		);
	}
	if (draft?.from && draft.to) {
		return (
			<p className="m-0 text-[11px] tabular-nums text-text-muted">
				{format(draft.from, "MMM d, yyyy")}
				<span className="text-text-dim"> – </span>
				{format(draft.to, "MMM d, yyyy")}
			</p>
		);
	}
	return (
		<p className="m-0 text-[11px] text-text-muted">
			Click two dates for a custom range
		</p>
	);
}

export function DateRangePanel({
	onApplied,
}: {
	onApplied?: () => void;
}) {
	const { from, to, setRange } = useFilters();
	const [draft, setDraft] = useState<DateRange | undefined>(() => toDraft(from, to));

	useEffect(() => {
		setDraft(toDraft(from, to));
	}, [from, to]);

	const activePreset = presetFromRange(from, to);

	function applyPreset(key: DateRangePreset) {
		const { from: f, to: t } = computePresetRange(key);
		setRange(f, t);
		onApplied?.();
	}

	function applyCustomRange(range: DateRange | undefined) {
		setDraft(range);
		if (range?.from && range?.to) {
			setRange(localDateString(range.from), localDateString(range.to));
			onApplied?.();
		}
	}

	const presetList = (
		<div className="flex flex-col gap-0.5 px-2 pb-3">
			{PRESETS.map((p) => {
				const active = activePreset === p.key;
				return (
					<button
						key={p.key}
						type="button"
						onClick={() => applyPreset(p.key)}
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
						{p.label}
					</button>
				);
			})}
		</div>
	);

	return (
		<div className="flex w-[392px] max-w-[calc(100vw-2rem)]" aria-label="Date range">
			<aside className="flex w-[148px] shrink-0 flex-col bg-bg">
				<p className="m-0 px-3 pt-3 pb-2 text-[11px] font-medium uppercase tracking-widest text-text-muted">
					Quick range
				</p>
				{presetList}
			</aside>

			<div className="flex min-w-0 flex-1 flex-col bg-bg-panel">
				<div className="flex justify-center px-3 pt-3 pb-1">
					<SignalCalendar
						mode="range"
						selected={draft}
						onSelect={applyCustomRange}
						defaultMonth={draft?.from ?? draft?.to ?? new Date()}
						numberOfMonths={1}
						disabled={{ after: new Date() }}
						className="p-0"
					/>
				</div>
				<div className="mt-auto px-3 py-2.5">
					<RangeFooter draft={draft} />
				</div>
			</div>
		</div>
	);
}
