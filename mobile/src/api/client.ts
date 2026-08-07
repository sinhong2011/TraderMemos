/**
 * Fetch wrapper for the TraderMemos API.
 *
 * Auth is `Authorization: Bearer <token>` with either a session JWT or a PAT
 * (`tm_pat_…`). On a 401 the access token is refreshed once via
 * POST /api/v1/auth/refresh and the request is replayed; a second 401 surfaces as
 * UnauthorizedError so the UI can send the user back to login.
 */

import type { Credentials, TokenPair } from './types';
import { clearTokens, saveTokens, type Session } from './session';
import { reportReachable, reportUnreachable } from '@/lib/connectivity';

const API_PREFIX = '/api/v1';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * No HTTP response at all — the request never reached the API. A self-hosted
 * server makes this the *ordinary* failure, not an edge case: the phone leaves
 * the LAN, the container is down, the tunnel dropped.
 *
 * It exists because `fetch` rejects with whatever the platform throws, and on
 * iOS that is Expo's `UnexpectedException: Could not connect to the server.
 * (at ExpoModulesCore/Promise.swift:56)` — a stack trace that screens were
 * rendering verbatim. Every reachability failure funnels through this one type
 * so `describeError` can say something a person can act on, and so retry
 * policy can treat "unreachable" differently from "the server said no".
 */
export class NetworkError extends Error {
  constructor(
    readonly serverUrl: string,
    cause?: unknown,
  ) {
    super('Could not reach the server');
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

/**
 * `fetch` that fails with `NetworkError` instead of a platform throw, and
 * doubles as the app's reachability probe: every request is already a live
 * test of whether the server answers, so the banner and the recovery poll are
 * driven from here rather than from a separate connectivity module.
 *
 * A *response* means reachable — including 4xx/5xx. Those are the server
 * talking, and treating them as "offline" would strand the user on a
 * connection screen while the API is plainly up.
 */
async function netFetch(serverUrl: string, url: string, init?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (cause) {
    reportUnreachable(serverUrl);
    throw new NetworkError(serverUrl, cause);
  }
  reportReachable();
  return response;
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Session expired') {
    super(401, 'unauthorized', message);
    this.name = 'UnauthorizedError';
  }
}

/** The API returns `{ error: { code, message } }` on failure. */
async function toApiError(response: Response): Promise<ApiError> {
  let code = 'unknown';
  let message = `Request failed (${response.status})`;
  try {
    const body = (await response.json()) as { error?: { code?: string; message?: string } };
    if (body.error?.code) code = body.error.code;
    if (body.error?.message) message = body.error.message;
  } catch {
    // Non-JSON error body (proxy error page, etc.) — keep the status-based message.
  }
  return new ApiError(response.status, code, message);
}

/** Query params accepted by `request` — Filters plus endpoint extras like `by`/`year`. */
export type QueryParams = Record<string, string | number | undefined>;

function buildUrl(serverUrl: string, path: string, params?: QueryParams): string {
  const url = new URL(`${API_PREFIX}${path}`, serverUrl);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value != null && value !== '') url.searchParams.set(key, String(value));
  }
  return url.toString();
}

/**
 * One refresh at a time: when the access token expires, every in-flight query
 * 401s at once — they must all await the same exchange instead of racing.
 */
let refreshInFlight: Promise<TokenPair> | null = null;

/**
 * Registered by the session provider. `clearTokens()` wipes SecureStore, but
 * the session the app actually renders from lives in React state, and the tabs
 * gate only redirects when *that* goes null. Without this hand-off an expired
 * refresh token left the user staring at "Your session expired" on every tab
 * with no route back to the login screen — the one error state where a retry
 * button would be a lie and the fix is a redirect.
 */
let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler;
}

/** Exchanges the refresh token for a new pair, persisting the result. */
function refreshTokens(serverUrl: string, refreshToken: string): Promise<TokenPair> {
  refreshInFlight ??= (async () => {
    try {
      const response = await netFetch(serverUrl, buildUrl(serverUrl, '/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!response.ok) {
        // Only a definitive rejection invalidates the stored session. Wiping on
        // transient failures (5xx, proxies) logged users out on the next boot.
        if (response.status === 401 || response.status === 403) {
          await clearTokens();
          onSessionExpired?.();
          throw new UnauthorizedError('Could not refresh session');
        }
        throw await toApiError(response);
      }
      const tokens = (await response.json()) as TokenPair;
      await saveTokens(tokens);
      return tokens;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  params?: QueryParams;
  body?: unknown;
  /** Multipart upload — wins over `body`; fetch sets the boundary header itself. */
  formData?: FormData;
};

/**
 * Authenticated request returning the raw `Response`, refreshing once on 401.
 * For payloads that aren't JSON bodies (file downloads that need headers like
 * Content-Disposition). Non-2xx still surfaces as ApiError.
 */
export async function requestRaw(
  session: Session,
  path: string,
  options: RequestOptions = {},
  onTokensRefreshed?: (tokens: TokenPair) => void,
): Promise<Response> {
  const { method = 'GET', params, body, formData } = options;
  const url = buildUrl(session.serverUrl, path, params);

  const send = (accessToken: string) =>
    netFetch(session.serverUrl, url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(body === undefined || formData != null ? {} : { 'Content-Type': 'application/json' }),
      },
      body: formData ?? (body === undefined ? undefined : JSON.stringify(body)),
    });

  let response = await send(session.accessToken);

  if (response.status === 401) {
    const tokens = await refreshTokens(session.serverUrl, session.refreshToken);
    onTokensRefreshed?.(tokens);
    response = await send(tokens.access_token);
    if (response.status === 401) throw new UnauthorizedError();
  }

  if (!response.ok) throw await toApiError(response);
  return response;
}

/**
 * Performs an authenticated request, refreshing once on 401.
 *
 * `onTokensRefreshed` lets the session provider adopt rotated tokens so the in-memory
 * session does not drift from SecureStore.
 */
export async function request<T>(
  session: Session,
  path: string,
  options: RequestOptions = {},
  onTokensRefreshed?: (tokens: TokenPair) => void,
): Promise<T> {
  const response = await requestRaw(session, path, options, onTokensRefreshed);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Unauthenticated — establishes the session that `request` then carries. */
export async function login(serverUrl: string, credentials: Credentials): Promise<TokenPair> {
  const response = await netFetch(serverUrl, buildUrl(serverUrl, '/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  if (!response.ok) throw await toApiError(response);
  return (await response.json()) as TokenPair;
}

/** Unauthenticated liveness probe, used to validate a server URL before login. */
export async function ping(serverUrl: string): Promise<boolean> {
  try {
    const response = await fetch(new URL('/healthz', serverUrl).toString());
    return response.ok;
  } catch {
    return false;
  }
}
