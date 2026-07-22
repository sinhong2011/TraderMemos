export const API_BASE_STORAGE_KEY = "tm_api_base";

/** Build-time default when no custom server is stored. */
export const DEFAULT_API_BASE = (import.meta.env.VITE_API as string) ?? "/api/v1";

let baseUrl = "";
let token = "";
let refreshToken = "";
let refreshInFlight: Promise<boolean> | null = null;
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

function tryStorage(): Storage | null {
  try {
    if (typeof localStorage !== "undefined" && typeof localStorage.getItem === "function") {
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

/**
 * Normalize a custom API base: trim, strip trailing slashes, and append `/api/v1`
 * when the user only entered an origin (or origin + `/`).
 */
export function normalizeApiBaseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const withoutTrailing = trimmed.replace(/\/+$/, "");
  try {
    const u = new URL(withoutTrailing, "http://local.invalid");
    const path = u.pathname.replace(/\/+$/, "") || "";
    if (!path || path === "/") {
      return `${withoutTrailing}/api/v1`;
    }
  } catch {
    /* keep as trimmed without trailing slash */
  }
  return withoutTrailing;
}

/**
 * Value for the API-server input: strip a trailing `/api/v1` so users only edit
 * the origin. {@link setBaseUrl} / {@link normalizeApiBaseUrl} re-append it.
 */
export function editableApiBaseUrl(stored: string): string {
  const trimmed = stored.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  if (trimmed === "/api/v1") return "";
  if (trimmed.endsWith("/api/v1")) {
    return trimmed.slice(0, -"/api/v1".length);
  }
  return trimmed;
}

/** Effective API base used by all clients (custom override or build default). */
export function getBaseUrl(): string {
  if (!baseUrl) {
    try {
      const saved = tryStorage()?.getItem(API_BASE_STORAGE_KEY);
      if (saved) baseUrl = saved;
    } catch {
      /* ignore */
    }
  }
  return baseUrl || DEFAULT_API_BASE;
}

/** Custom override only — empty means the build-time {@link DEFAULT_API_BASE} is used. */
export function getCustomApiBaseUrl(): string {
  if (baseUrl) return baseUrl;
  try {
    return tryStorage()?.getItem(API_BASE_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

/**
 * Persist a custom TraderMemos API base. Pass empty string to clear and fall
 * back to {@link DEFAULT_API_BASE}.
 */
export function setBaseUrl(url: string) {
  const next = normalizeApiBaseUrl(url);
  baseUrl = next;
  persist(API_BASE_STORAGE_KEY, next);
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
        const res = await fetch(`${getBaseUrl()}/auth/refresh`, {
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
  const res = await fetch(getBaseUrl() + path, {
    ...opts,
    headers: {
      ...(opts.body && !(opts.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      ...opts.headers,
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
    throw new ApiError(res.status, e.code ?? "error", e.message ?? res.statusText);
  }
  return body as T;
}

/** Authenticated GET that returns the raw Response (for file downloads). */
export async function apiRawGet(path: string, retried = false): Promise<Response> {
  const auth = getToken();
  const res = await fetch(getBaseUrl() + path, {
    headers: auth ? { Authorization: `Bearer ${auth}` } : {},
  });
  if (res.status === 401 && !path.startsWith("/auth/")) {
    if (!retried && (await tryRefresh())) {
      return apiRawGet(path, true);
    }
    onUnauthorized?.();
  }
  return res;
}

/** Map an API base (`/api/v1` or `https://host/api/v1`) to an API-root path (e.g. `/healthz`, `/docs`). */
export function apiRootUrl(apiBase: string, path: string): string {
  const trimmed = apiBase.trim().replace(/\/+$/, "");
  const root = trimmed.replace(/\/api\/v1$/i, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  if (/^https?:\/\//i.test(root)) {
    return `${root}${suffix}`;
  }
  return root ? `${root}${suffix}` : suffix;
}

/** Map an API base (`/api/v1` or `https://host/api/v1`) to the root `/healthz` probe. */
export function apiHealthUrl(apiBase: string): string {
  return apiRootUrl(apiBase, "/healthz");
}

/** Map an API base to the public Scalar docs UI. */
export function apiDocsUrl(apiBase: string): string {
  return apiRootUrl(apiBase, "/docs");
}

export function qs(params: Record<string, string | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) u.set(k, v);
  const s = u.toString();
  return s ? `?${s}` : "";
}
