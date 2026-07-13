import { apiFetch, qs } from "./client";
import type { CashTransaction, Filters } from "./types";

interface CashBody {
	account_id: string;
	type: string;
	amount: number;
	currency: string;
	occurred_at: string;
	note?: string;
	trade_id?: string;
}

export const cashApi = {
	list: (f: Filters) =>
		apiFetch<CashTransaction[]>(
			`/cash-transactions${qs(f as Record<string, string | undefined>)}`,
		),
	create: (body: CashBody) =>
		apiFetch<CashTransaction>("/cash-transactions", {
			method: "POST",
			body: JSON.stringify(body),
		}),
	delete: (id: string) =>
		apiFetch<void>(`/cash-transactions/${id}`, { method: "DELETE" }),
};
