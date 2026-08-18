import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tradesApi } from "@/lib/api/trades";
import { armRollingNumbers } from "@/lib/rollingNumbers";

export function useTradeDetail(id: string) {
  return useQuery({
    queryKey: ["trade", id],
    queryFn: () => tradesApi.get(id),
    enabled: Boolean(id) && !id.startsWith("import-preview:"),
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

export function useComputeExcursion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tradesApi.computeExcursion(id),
    onSuccess: (_data, id) => {
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
      // Removing a trade moves the same figures a new one does, and the user
      // caused it just as directly — it rolls for the same reason.
      armRollingNumbers();
      void queryClient.invalidateQueries({ queryKey: ["trades"] });
      void queryClient.invalidateQueries({ queryKey: ["trade", id] });
      void queryClient.invalidateQueries({ queryKey: ["analytics"] });
      void queryClient.invalidateQueries({ queryKey: ["cash"] });
    },
  });
}
