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

/** Exchanges the refresh token for a new pair, persisting the result. */
async function refreshTokens(serverUrl: string, refreshToken: string): Promise<TokenPair> {
  const response = await fetch(buildUrl(serverUrl, '/auth/refresh'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!response.ok) {
    await clearTokens();
    throw new UnauthorizedError('Could not refresh session');
  }
  const tokens = (await response.json()) as TokenPair;
  await saveTokens(tokens);
  return tokens;
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  params?: QueryParams;
  body?: unknown;
};

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
  const { method = 'GET', params, body } = options;
  const url = buildUrl(session.serverUrl, path, params);

  const send = (accessToken: string) =>
    fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  let response = await send(session.accessToken);

  if (response.status === 401) {
    const tokens = await refreshTokens(session.serverUrl, session.refreshToken);
    onTokensRefreshed?.(tokens);
    response = await send(tokens.access_token);
    if (response.status === 401) throw new UnauthorizedError();
  }

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Unauthenticated — establishes the session that `request` then carries. */
export async function login(serverUrl: string, credentials: Credentials): Promise<TokenPair> {
  const response = await fetch(buildUrl(serverUrl, '/auth/login'), {
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
