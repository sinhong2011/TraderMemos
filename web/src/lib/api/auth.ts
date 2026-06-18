import { apiFetch } from "./client";
import type { Tokens } from "./types";

export const authApi = {
	register: (email: string, password: string) =>
		apiFetch<{ id: string; email: string }>("/auth/register", {
			method: "POST",
			body: JSON.stringify({ email, password }),
		}),
	login: (email: string, password: string) =>
		apiFetch<Tokens>("/auth/login", {
			method: "POST",
			body: JSON.stringify({ email, password }),
		}),
	refresh: (refresh_token: string) =>
		apiFetch<Tokens>("/auth/refresh", {
			method: "POST",
			body: JSON.stringify({ refresh_token }),
		}),
};
