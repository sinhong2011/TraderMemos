import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { backupApi, backupNeedsAttention } from "@/lib/api/backup";
import { useMe } from "./useMe";

const BACKUP_KEY = ["admin", "backup"];

/**
 * Snapshot status. Owner-only — the API answers 403 to anyone else, so callers
 * gate the query on `me.is_admin`.
 */
export function useBackupStatus(enabled: boolean) {
  return useQuery({
    queryKey: BACKUP_KEY,
    queryFn: () => backupApi.status(),
    enabled,
    // The schedule runs server-side; a slow poll keeps the shell dot honest
    // without the owner reloading.
    refetchInterval: 5 * 60_000,
  });
}

export function useRunBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => backupApi.run(),
    onSuccess: (status) => qc.setQueryData(BACKUP_KEY, status),
    // A failed run records its error server-side; refetch so it shows.
    onError: () => qc.invalidateQueries({ queryKey: BACKUP_KEY }),
  });
}

/**
 * Backup health for the app shell: true when the last snapshot attempt failed
 * or the newest snapshot is overdue. Like a dead broker sync, a backup that
 * quietly stopped looks identical to one that works until the day it's needed.
 * Members never ask (the endpoint is owner-only).
 */
export function useBackupAttention(): boolean {
  const me = useMe();
  const { data } = useBackupStatus(me.data?.is_admin ?? false);
  return backupNeedsAttention(data);
}
