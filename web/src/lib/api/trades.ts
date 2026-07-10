import { apiFetch, qs } from "./client";
import type { Filters, Trade, TradeDetail } from "./types";

export const tradesApi = {
	list: (f: Filters) =>
		apiFetch<Trade[]>(`/trades${qs(f as Record<string, string | undefined>)}`),
	get: (id: string) => apiFetch<TradeDetail>(`/trades/${id}`),
	patch: (
		id: string,
		body: {
			notes?: string;
			setup_id?: string;
			initial_risk?: number;
			target_price?: number;
			stop_price?: number;
			emotional_state?: string;
			confidence?: number;
			trade_quality?: number;
			mae?: number;
			mfe?: number;
			tag_ids?: string[];
		},
	) =>
		apiFetch<TradeDetail>(`/trades/${id}`, {
			method: "PATCH",
			body: JSON.stringify(body),
		}),
	regroup: (account_id: string) =>
		apiFetch<void>("/trades/regroup", {
			method: "POST",
			body: JSON.stringify({ account_id }),
		}),
};
