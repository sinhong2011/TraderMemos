import { apiFetch } from "./client";
import type { Account } from "./types";

interface AccountBody {
	name: string;
	broker: string;
	account_type: string;
	base_currency: string;
	starting_balance: number;
}

export const accountsApi = {
	list: () => apiFetch<Account[]>("/accounts"),
	get: (id: string) => apiFetch<Account>(`/accounts/${id}`),
	create: (body: AccountBody) =>
		apiFetch<Account>("/accounts", {
			method: "POST",
			body: JSON.stringify(body),
		}),
	update: (id: string, body: Partial<AccountBody>) =>
		apiFetch<Account>(`/accounts/${id}`, {
			method: "PUT",
			body: JSON.stringify(body),
		}),
	delete: (id: string) =>
		apiFetch<void>(`/accounts/${id}`, { method: "DELETE" }),
};
