import { SignalSelect } from "./SignalSelect";
import {
	computePresetRange,
	presetFromRange,
	type DateRangePreset,
} from "../lib/dateRangePresets";
import { useFilters } from "../lib/filters";

const PRESETS: { label: string; key: DateRangePreset }[] = [
	{ label: "Last 7 days", key: "7d" },
	{ label: "Last 30 days", key: "30d" },
	{ label: "Last 90 days", key: "90d" },
	{ label: "This month", key: "month" },
	{ label: "All time", key: "all" },
];

export function DateRangePicker() {
	const { from, to, setRange } = useFilters();
	const active = presetFromRange(from, to);

	const options = [
		...PRESETS.map((p) => ({ value: p.key, label: p.label })),
		...(active === "custom"
			? [{ value: "custom" as const, label: "Custom range", disabled: true }]
			: []),
	];

	return (
		<SignalSelect
			value={active}
			onValueChange={(key) => {
				if (key === "custom") return;
				const { from: f, to: t } = computePresetRange(key as DateRangePreset);
				setRange(f, t);
			}}
			options={options}
			ariaLabel="Date range"
			triggerClassName="min-w-[132px] font-mono text-[11px] text-text-muted"
		/>
	);
}
