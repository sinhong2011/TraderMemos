const BASE = (import.meta.env.VITE_API as string) ?? "/api/v1";
let token = "";

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

export function setToken(t: string) {
	token = t;
	try {
		const s = tryStorage();
		if (s) {
			if (t) s.setItem("tm_token", t);
			else s.removeItem("tm_token");
		}
	} catch {
		/* ignore */
	}
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

export class ApiError extends Error {
	code: string;
	status: number;
	constructor(status: number, code: string, message: string) {
		super(message);
		this.code = code;
		this.status = status;
	}
}

export async function apiFetch<T = unknown>(
	path: string,
	opts: RequestInit = {},
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
