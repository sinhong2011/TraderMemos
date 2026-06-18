import { apiFetch, qs } from "./client";
import type { BreakGroup, EquityCurve, Filters, Summary } from "./types";

export const analyticsApi = {
	summary: (f: Filters) =>
		apiFetch<Summary>(
			`/analytics/summary${qs(f as Record<string, string | undefined>)}`,
		),
	equityCurve: (f: Filters) =>
		apiFetch<EquityCurve>(
			`/analytics/equity-curve${qs(f as Record<string, string | undefined>)}`,
		),
	daily: (f: Filters) =>
		apiFetch<Record<string, number>>(
			`/analytics/daily${qs(f as Record<string, string | undefined>)}`,
		),
	breakdown: (by: string, f: Filters) =>
		apiFetch<BreakGroup[]>(
			`/analytics/breakdown${qs({ by, ...(f as Record<string, string | undefined>) })}`,
		),
};
