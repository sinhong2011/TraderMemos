import { apiFetch } from "./client";
import type { Tokens } from "./types";

export interface SetupStatus {
  needs_setup: boolean;
  registration_open: boolean;
  user_count: number;
  min_password_length: number;
}

export interface SetupAccountInput {
  name: string;
  broker?: string;
  account_type?: string;
  base_currency?: string;
  starting_balance?: number;
}

/** GET /me — the signed-in account. */
export interface Me {
  id: string;
  email: string;
  is_admin: boolean;
  created_at: string;
  /** Always false today: the column exists server-side but nothing writes it. */
  totp_enabled: boolean;
}

/** POST /me/totp/start — a candidate secret, not yet stored server-side. */
export interface TotpSetup {
  secret: string;
  otpauth_url: string;
}

export interface SetupResult extends Tokens {
  id: string;
  email: string;
  is_admin: boolean;
  account?: unknown;
}

const SETUP_STATUS_TTL_MS = 5_000;
let setupStatusCache: { at: number; data: SetupStatus } | null = null;
let setupStatusInFlight: Promise<SetupStatus> | null = null;

function invalidateSetupStatus() {
  setupStatusCache = null;
  setupStatusInFlight = null;
}

async function fetchSetupStatus(): Promise<SetupStatus> {
  const now = Date.now();
  if (setupStatusCache && now - setupStatusCache.at < SETUP_STATUS_TTL_MS) {
    return setupStatusCache.data;
  }
  if (!setupStatusInFlight) {
    setupStatusInFlight = apiFetch<SetupStatus>("/setup/status")
      .then((data) => {
        setupStatusCache = { at: Date.now(), data };
        return data;
      })
      .finally(() => {
        setupStatusInFlight = null;
      });
  }
  return setupStatusInFlight;
}

export const authApi = {
  setupStatus: () => fetchSetupStatus(),
  completeSetup: async (email: string, password: string, account?: SetupAccountInput) => {
    const result = await apiFetch<SetupResult>("/setup", {
      method: "POST",
      body: JSON.stringify({ email, password, account: account ?? null }),
    });
    invalidateSetupStatus();
    return result;
  },
  register: (email: string, password: string) =>
    apiFetch<{ id: string; email: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  /** `totpCode` goes on the second leg, after a 401 with code `totp_required`. */
  login: (email: string, password: string, totpCode?: string) =>
    apiFetch<Tokens>("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        ...(totpCode ? { totp_code: totpCode } : {}),
      }),
    }),
  me: () => apiFetch<Me>("/me"),
  /**
   * Returns a fresh token pair: the change invalidates every token minted
   * against the old password, including the one this request carried, so the
   * caller has to adopt the new pair or it signs itself out too.
   */
  changePassword: (current_password: string, new_password: string) =>
    apiFetch<Tokens>("/me/password", {
      method: "PUT",
      body: JSON.stringify({ current_password, new_password }),
    }),
  totpStart: () => apiFetch<TotpSetup>("/me/totp/start", { method: "POST" }),
  totpConfirm: (secret: string, code: string) =>
    apiFetch<void>("/me/totp/confirm", {
      method: "POST",
      body: JSON.stringify({ secret, code }),
    }),
  totpDisable: (password: string, code: string) =>
    apiFetch<void>("/me/totp/disable", {
      method: "POST",
      body: JSON.stringify({ password, code }),
    }),
  refresh: (refresh_token: string) =>
    apiFetch<Tokens>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh_token }),
    }),
};
