import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type MissedTradeBody, missedTradesApi } from "@/lib/api/missedTrades";
import type { Filters } from "@/lib/api/types";

const KEY = ["missed-trades"] as const;

export function useMissedTrades(filters: Filters) {
  return useQuery({
    queryKey: [...KEY, "list", filters],
    queryFn: () => missedTradesApi.list(filters),
  });
}

export function useMissedSummary(filters: Filters) {
  return useQuery({
    queryKey: [...KEY, "summary", filters],
    queryFn: () => missedTradesApi.summary(filters),
  });
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: KEY });
}

export function useSaveMissedTrade() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, body }: { id: string | null; body: MissedTradeBody }) =>
      id ? missedTradesApi.update(id, body) : missedTradesApi.create(body),
    onSuccess: invalidate,
  });
}

export function useDeleteMissedTrade() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: missedTradesApi.delete, onSuccess: invalidate });
}
