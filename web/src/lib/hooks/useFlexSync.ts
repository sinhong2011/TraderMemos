import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FlexSyncSave, flexSyncApi, flexSyncFailed } from "@/lib/api/flexSync";

export function useFlexSync(accountId: string, enabled = true) {
  return useQuery({
    queryKey: ["flex-sync", accountId],
    queryFn: () => flexSyncApi.get(accountId),
    enabled: enabled && Boolean(accountId),
  });
}

/** Every configured broker connection, one request for the whole account list. */
export function useFlexSyncConnections(enabled = true) {
  return useQuery({
    queryKey: ["flex-sync"],
    queryFn: () => flexSyncApi.list(),
    enabled,
  });
}

/**
 * Sync health for the app shell: true while any configured connection's last
 * attempt failed. A silently dead scheduled sync looks identical to a quiet
 * trading week, so the shell surfaces it instead of waiting for the user to
 * open the right modal.
 */
export function useFlexSyncAttention(): boolean {
  const { data } = useFlexSyncConnections();
  return (data ?? []).some(flexSyncFailed);
}

export function useSaveFlexSync(accountId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: FlexSyncSave) => flexSyncApi.save(accountId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["flex-sync"] });
    },
  });
}

export function useDeleteFlexSync(accountId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => flexSyncApi.remove(accountId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["flex-sync"] });
    },
  });
}

export function useRunFlexSync(accountId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => flexSyncApi.run(accountId),
    onSuccess: () => {
      // A sync inserts executions and regroups trades — refresh everything.
      void qc.invalidateQueries({ queryKey: ["flex-sync"] });
      void qc.invalidateQueries({ queryKey: ["trades"] });
      void qc.invalidateQueries({ queryKey: ["analytics"] });
      void qc.invalidateQueries({ queryKey: ["imports"] });
    },
  });
}
