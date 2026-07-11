const BASE = (import.meta.env.VITE_API as string) ?? "/api/v1";
let token = "";
let refreshToken = "";
let refreshInFlight: Promise<boolean> | null = null;
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
	onUnauthorized = handler;
}

function tryStorage(): Storage | null {
	try {
		if (
			typeof localStorage !== "undefined" &&
			typeof localStorage.getItem === "function"
		) {
			return localStorage;
		}
	} catch {
		/* ignore */
	}
	return null;
}

function persist(key: string, value: string) {
	try {
		const s = tryStorage();
		if (s) {
			if (value) s.setItem(key, value);
			else s.removeItem(key);
		}
	} catch {
		/* ignore */
	}
}

export function setToken(t: string) {
	token = t;
	persist("tm_token", t);
}

export function setTokens(access: string, refresh: string) {
	setToken(access);
	refreshToken = refresh;
	persist("tm_refresh", refresh);
}

export function getToken() {
	if (!token) {
		try {
			const saved = tryStorage()?.getItem("tm_token");
			if (saved) token = saved;
		} catch {
			/* ignore */
		}
	}
	return token;
}

export function getRefreshToken() {
	if (!refreshToken) {
		try {
			const saved = tryStorage()?.getItem("tm_refresh");
			if (saved) refreshToken = saved;
		} catch {
			/* ignore */
		}
	}
	return refreshToken;
}

export class ApiError extends Error {
	code: string;
	status: number;
	constructor(status: number, code: string, message: string) {
		super(message);
		this.code = code;
		this.status = status;
	}
}

// Exchange the refresh token for fresh tokens. Single-flight: concurrent 401s
// await the same refresh request. Uses fetch directly (not apiFetch) so a
// failing refresh can never recurse.
function tryRefresh(): Promise<boolean> {
	if (!refreshInFlight) {
		refreshInFlight = (async () => {
			const rt = getRefreshToken();
			if (!rt) return false;
			try {
				const res = await fetch(`${BASE}/auth/refresh`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ refresh_token: rt }),
				});
				if (!res.ok) return false;
				const body = await res.json().catch(() => ({}));
				if (!body?.access_token) return false;
				setTokens(body.access_token, body.refresh_token ?? rt);
				return true;
			} catch {
				return false;
			}
		})().finally(() => {
			refreshInFlight = null;
		});
	}
	return refreshInFlight;
}

export async function apiFetch<T = unknown>(
	path: string,
	opts: RequestInit = {},
	retried = false,
): Promise<T> {
	const auth = getToken(); // lazily hydrates the token from storage on first use
	const res = await fetch(BASE + path, {
		...opts,
		headers: {
			...(opts.body && !(opts.body instanceof FormData)
				? { "Content-Type": "application/json" }
				: {}),
			...(auth ? { Authorization: `Bearer ${auth}` } : {}),
			...(opts.headers ?? {}),
		},
	});
	if (res.status === 204) return undefined as T;
	const body = await res.json().catch(() => ({}));
	if (!res.ok) {
		if (res.status === 401 && !path.startsWith("/auth/")) {
			if (!retried && (await tryRefresh())) {
				return apiFetch<T>(path, opts, true);
			}
			onUnauthorized?.();
		}
		const e = body?.error ?? {};
		throw new ApiError(
			res.status,
			e.code ?? "error",
			e.message ?? res.statusText,
		);
	}
	return body as T;
}

export function qs(params: Record<string, string | undefined>): string {
	const u = new URLSearchParams();
	for (const [k, v] of Object.entries(params)) if (v) u.set(k, v);
	const s = u.toString();
	return s ? `?${s}` : "";
}
