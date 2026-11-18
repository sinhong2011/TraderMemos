import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { mcpApi, type PutMcpSettingsBody } from "@/lib/api/mcp";

const KEY = ["settings", "mcp"] as const;

export function useMcpSettings() {
  return useQuery({ queryKey: KEY, queryFn: () => mcpApi.getSettings() });
}

export function useSaveMcpSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PutMcpSettingsBody) => mcpApi.putSettings(body),
    onSuccess: (data) => {
      qc.setQueryData(KEY, data);
    },
  });
}
