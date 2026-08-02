import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FlexSyncSave, flexSyncApi } from "@/lib/api/flexSync";

export function useFlexSync(accountId: string, enabled = true) {
  return useQuery({
    queryKey: ["flex-sync", accountId],
    queryFn: () => flexSyncApi.get(accountId),
    enabled: enabled && Boolean(accountId),
  });
}

export function useSaveFlexSync(accountId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: FlexSyncSave) => flexSyncApi.save(accountId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["flex-sync", accountId] });
    },
  });
}

export function useDeleteFlexSync(accountId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => flexSyncApi.remove(accountId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["flex-sync", accountId] });
    },
  });
}

export function useRunFlexSync(accountId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => flexSyncApi.run(accountId),
    onSuccess: () => {
      // A sync inserts executions and regroups trades — refresh everything.
      void qc.invalidateQueries({ queryKey: ["flex-sync", accountId] });
      void qc.invalidateQueries({ queryKey: ["trades"] });
      void qc.invalidateQueries({ queryKey: ["analytics"] });
      void qc.invalidateQueries({ queryKey: ["imports"] });
    },
  });
}
