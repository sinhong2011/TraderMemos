import { normalizeFilterDate } from "./filters";
import { intlLocale } from "./locale";

export type DateRangePreset = "7d" | "30d" | "90d" | "month" | "all" | "custom";

export const PRESET_LABELS: Record<DateRangePreset, string> = {
	"7d": "Last 7 days",
	"30d": "Last 30 days",
	"90d": "Last 90 days",
	month: "This month",
	all: "All time",
	custom: "Custom range",
};

/** Calendar date in the user's local timezone (YYYY-MM-DD). */
export function localDateString(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

export function datePart(iso?: string): string | undefined {
	return iso?.slice(0, 10);
}

function daysBetween(start: string, end: string): number {
	const [sy, sm, sd] = start.split("-").map(Number);
	const [ey, em, ed] = end.split("-").map(Number);
	const t0 = Date.UTC(sy, sm - 1, sd);
	const t1 = Date.UTC(ey, em - 1, ed);
	return Math.round((t1 - t0) / 86_400_000);
}

function toRangeBounds(fromDate: string, toDate: string) {
	return {
		from: normalizeFilterDate(fromDate, "start"),
		to: normalizeFilterDate(toDate, "end"),
	};
}

export function computePresetRange(
	key: DateRangePreset,
	now = new Date(),
): { from?: string; to?: string } {
	const today = localDateString(now);

	if (key === "7d") {
		const from = new Date(now);
		from.setDate(from.getDate() - 6);
		return toRangeBounds(localDateString(from), today);
	}
	if (key === "30d") {
		const from = new Date(now);
		from.setDate(from.getDate() - 29);
		return toRangeBounds(localDateString(from), today);
	}
	if (key === "90d") {
		const from = new Date(now);
		from.setDate(from.getDate() - 89);
		return toRangeBounds(localDateString(from), today);
	}
	if (key === "month") {
		const from = new Date(now.getFullYear(), now.getMonth(), 1);
		return toRangeBounds(localDateString(from), today);
	}
	return { from: undefined, to: undefined };
}

export function presetFromRange(
	from?: string,
	to?: string,
	now = new Date(),
): DateRangePreset {
	if (!from && !to) return "all";

	const today = localDateString(now);
	const fromDay = datePart(from);
	const toDay = datePart(to);
	if (!fromDay || !toDay || toDay !== today) return "custom";

	const diffDays = daysBetween(fromDay, today);
	if (diffDays === 6) return "7d";
	if (diffDays === 29) return "30d";
	if (diffDays === 89) return "90d";

	const monthStart = localDateString(
		new Date(now.getFullYear(), now.getMonth(), 1),
	);
	if (fromDay === monthStart) return "month";

	return "custom";
}

/** Parse filter ISO to local calendar date (no time shift). */
export function parseFilterDay(iso?: string): Date | undefined {
	const day = datePart(iso);
	if (!day) return undefined;
	const [y, m, d] = day.split("-").map(Number);
	return new Date(y, m - 1, d);
}

/** Human-readable label for the header date trigger. */
export function formatRangeLabel(
	from?: string,
	to?: string,
	now = new Date(),
): string {
	const preset = presetFromRange(from, to, now);
	if (preset !== "custom") return PRESET_LABELS[preset];

	const fromDay = datePart(from);
	const toDay = datePart(to);
	if (!fromDay && !toDay) return PRESET_LABELS.all;
	if (fromDay && toDay) {
		const fmt = (d: string) => {
			const [y, m, day] = d.split("-").map(Number);
			return new Date(y, m - 1, day).toLocaleDateString(intlLocale(), {
				month: "short",
				day: "numeric",
				...(fromDay.slice(0, 4) !== toDay.slice(0, 4)
					? { year: "numeric" }
					: {}),
			});
		};
		const left = fmt(fromDay);
		const right = fmt(toDay);
		if (fromDay === toDay) return left;
		return `${left} – ${right}`;
	}
	return PRESET_LABELS.custom;
}
