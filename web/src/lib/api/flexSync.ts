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

export const flexSyncApi = {
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
