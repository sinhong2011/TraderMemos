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
      body: {
        notes?: string;
        setup_id?: string;
        setup_ids?: string[];
        initial_risk?: number;
        target_price?: number;
        stop_price?: number;
        emotional_state?: string;
        confidence?: number;
        trade_quality?: number;
        mae?: number;
        mfe?: number;
        tag_ids?: string[];
      };
    }) => tradesApi.patch(id, body),
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ["trades"] });
      void queryClient.invalidateQueries({ queryKey: ["trade", id] });
    },
  });
}

export function useDeleteTrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tradesApi.delete(id),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: ["trades"] });
      void queryClient.invalidateQueries({ queryKey: ["trade", id] });
      void queryClient.invalidateQueries({ queryKey: ["analytics"] });
      void queryClient.invalidateQueries({ queryKey: ["cash"] });
    },
  });
}
