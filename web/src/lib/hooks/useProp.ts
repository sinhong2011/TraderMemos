import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { propApi, type PropSettings } from "@/lib/api/prop";

export function usePropSettings(accountId: string, enabled = true) {
  return useQuery({
    queryKey: ["prop", "settings", accountId],
    queryFn: () => propApi.getSettings(accountId),
    enabled: enabled && Boolean(accountId),
  });
}

export function useSavePropSettings(accountId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PropSettings) => propApi.putSettings(accountId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["prop"] });
    },
  });
}

export function usePropStatus(accountId: string | undefined, tz?: string, enabled = true) {
  return useQuery({
    queryKey: ["prop", "status", accountId ?? null, tz ?? null],
    queryFn: () => propApi.status(accountId ?? "", tz),
    enabled: enabled && Boolean(accountId),
  });
}
