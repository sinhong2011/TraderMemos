import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tradesApi } from "../api/trades";

export function useTradeDetail(id: string) {
  return useQuery({
    queryKey: ["trade", id],
    queryFn: () => tradesApi.get(id),
    enabled: Boolean(id),
  });
}

export function usePatchTrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: { notes?: string; setup_id?: string; initial_risk?: number; tag_ids?: string[] };
    }) => tradesApi.patch(id, body),
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ["trades"] });
      void queryClient.invalidateQueries({ queryKey: ["trade", id] });
    },
  });
}
