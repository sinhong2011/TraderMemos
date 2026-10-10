import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type ChangeBody,
  type SystemVersionBody,
  type TradeSystemCardBody,
  systemApi,
} from "@/lib/api/system";
import type { Filters } from "@/lib/api/types";

const KEY = ["trading-system"] as const;

export function useTradingSystem() {
  return useQuery({ queryKey: KEY, queryFn: systemApi.get });
}

export function useSystemChanges() {
  return useQuery({ queryKey: [...KEY, "changes"], queryFn: systemApi.changes });
}

export function useMarketRegime(day: string) {
  return useQuery({
    queryKey: [...KEY, "regime", day],
    queryFn: () => systemApi.getRegime(day),
    enabled: Boolean(day),
  });
}

export function useTradeSystemCard(tradeId: string | undefined) {
  return useQuery({
    queryKey: [...KEY, "card", tradeId],
    queryFn: () => systemApi.getCard(tradeId!),
    enabled: Boolean(tradeId),
  });
}

export function useSystemReview(filters: Filters & { version_id?: string }) {
  return useQuery({
    queryKey: [...KEY, "review", filters],
    queryFn: () => systemApi.review(filters),
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: KEY });
}

export function useStartSystemVersion() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: systemApi.startVersion, onSuccess: invalidate });
}

export function useSaveSystemVersion() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: SystemVersionBody }) =>
      systemApi.saveVersion(id, body),
    onSuccess: invalidate,
  });
}

export function useDiscardSystemDraft() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: systemApi.discardDraft, onSuccess: invalidate });
}

export function useActivateSystemVersion() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: ChangeBody[] }) =>
      systemApi.activate(id, changes),
    onSuccess: invalidate,
  });
}

export function usePutMarketRegime() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ day, regime, note }: { day: string; regime: string; note?: string }) =>
      systemApi.putRegime(day, { regime, note }),
    onSuccess: invalidate,
  });
}

export function useSaveTradeSystemCard() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ tradeId, body }: { tradeId: string; body: TradeSystemCardBody }) =>
      systemApi.putCard(tradeId, body),
    onSuccess: invalidate,
  });
}
