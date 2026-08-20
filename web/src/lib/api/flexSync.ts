import { apiFetch } from "./client";

export interface FlexSyncSettings {
  configured: boolean;
  enabled: boolean;
  query_id?: string;
  token_set: boolean;
  token_hint?: string;
  last_synced_at?: string;
  last_status?: string;
  last_error?: string;
}

export interface FlexSyncSave {
  query_id: string;
  enabled: boolean;
  /** Omit or empty to keep the stored token. */
  token?: string;
}

export interface FlexSyncRunResult {
  inserted: number;
  skipped: number;
  trades: number;
  rows: number;
}

/** A configured connection: the settings row plus the account it belongs to. */
export interface FlexSyncConnection extends FlexSyncSettings {
  account_id: string;
  account_name: string;
}

/** True when the connection's last sync attempt failed. */
export function flexSyncFailed(s: Pick<FlexSyncSettings, "last_status" | "last_error">): boolean {
  return s.last_status === "error" || Boolean(s.last_error);
}

export const flexSyncApi = {
  list: () => apiFetch<FlexSyncConnection[]>(`/flex-sync`),
  get: (accountId: string) => apiFetch<FlexSyncSettings>(`/accounts/${accountId}/flex-sync`),
  save: (accountId: string, body: FlexSyncSave) =>
    apiFetch<FlexSyncSettings>(`/accounts/${accountId}/flex-sync`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  remove: (accountId: string) =>
    apiFetch<void>(`/accounts/${accountId}/flex-sync`, { method: "DELETE" }),
  run: (accountId: string) =>
    apiFetch<FlexSyncRunResult>(`/accounts/${accountId}/flex-sync/run`, { method: "POST" }),
};
