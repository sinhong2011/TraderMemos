import { apiFetch } from "./client";

export type BackupState = "ok" | "none" | "failed" | "stale" | "disabled" | "unsupported";

export interface BackupFile {
  name: string;
  size_bytes: number;
  created_at: string;
}

/** `GET /admin/backup` — owner-only snapshot status. */
export interface BackupStatus {
  enabled: boolean;
  driver: string;
  status: BackupState;
  /** Set for `unsupported` (Postgres). */
  hint?: string;
  dir?: string;
  keep: number;
  interval_min: number;
  running: boolean;
  last_success_at: string | null;
  last_attempt_at: string | null;
  last_error?: string;
  latest: BackupFile | null;
  file_count: number;
}

/**
 * True when the shell should flag backups: the last attempt failed, or the
 * newest snapshot is older than twice the interval. The server computes both
 * into `status`; Postgres (`unsupported`), a deliberately disabled schedule and
 * a fresh install (`none`) are not failures.
 */
export function backupNeedsAttention(s: Pick<BackupStatus, "status"> | null | undefined): boolean {
  return s?.status === "failed" || s?.status === "stale";
}

export const backupApi = {
  status: () => apiFetch<BackupStatus>("/admin/backup"),
  run: () => apiFetch<BackupStatus>("/admin/backup", { method: "POST" }),
};
