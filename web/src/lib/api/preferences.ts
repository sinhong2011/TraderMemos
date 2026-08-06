import { apiFetch } from "./client";

/** The server stores an opaque object; the shape is the clients' business. */
export type SyncedPrefs = Record<string, unknown>;

export interface PreferencesResponse {
  prefs: SyncedPrefs;
  /** Absent until this account has synced something. */
  updated_at?: string;
}

export const preferencesApi = {
  get: () => apiFetch<PreferencesResponse>("/me/preferences"),
  /** Merges the given keys server-side; keys not sent are left alone. */
  patch: (patch: SyncedPrefs) =>
    apiFetch<PreferencesResponse>("/me/preferences", {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
};
