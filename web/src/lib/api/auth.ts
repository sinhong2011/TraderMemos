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
