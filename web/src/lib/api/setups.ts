import { apiFetch } from "./client";
import type { Setup } from "./types";

export interface SetupBody {
	name: string;
	description?: string;
	thesis?: string;
	symbol?: string;
	direction?: string;
	target_price?: number | null;
	stop_price?: number | null;
	checklist?: string[];
}

export const setupsApi = {
	list: () => apiFetch<Setup[]>("/setups"),
	get: (id: string) => apiFetch<Setup>(`/setups/${id}`),
	create: (body: SetupBody) =>
		apiFetch<Setup>("/setups", { method: "POST", body: JSON.stringify(body) }),
	update: (id: string, body: SetupBody) =>
		apiFetch<Setup>(`/setups/${id}`, {
			method: "PATCH",
			body: JSON.stringify(body),
		}),
	delete: (id: string) => apiFetch<void>(`/setups/${id}`, { method: "DELETE" }),
};
