import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type ChangeBody,
  type CreatePlanBody,
  type PlanRevisionBody,
  type PlanStatus,
  type SystemPlanDetail,
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

export function useRenameSystemVersion() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => systemApi.renameVersion(id, name),
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

const PLANS_KEY = [...KEY, "plans"] as const;

export function useSystemPlans() {
  return useQuery({ queryKey: PLANS_KEY, queryFn: systemApi.plans });
}

export function useSystemPlan(id: string | null) {
  return useQuery({
    queryKey: [...PLANS_KEY, "detail", id],
    queryFn: () => systemApi.getPlan(id!),
    enabled: Boolean(id),
  });
}

export function usePlanCandidates(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...PLANS_KEY, "candidates", id],
    queryFn: () => systemApi.planTrades(id!),
    enabled: Boolean(id) && enabled,
  });
}

/** Seeds the detail cache with the server's answer, then refreshes the list. */
function usePlanSettled() {
  const qc = useQueryClient();
  return (plan: SystemPlanDetail) => {
    qc.setQueryData([...PLANS_KEY, "detail", plan.id], plan);
    return qc.invalidateQueries({ queryKey: PLANS_KEY });
  };
}

export function useCreateSystemPlan() {
  const settled = usePlanSettled();
  return useMutation({
    mutationFn: (body: CreatePlanBody) => systemApi.createPlan(body),
    onSuccess: settled,
  });
}

export function useAddPlanRevision() {
  const settled = usePlanSettled();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: PlanRevisionBody }) =>
      systemApi.addPlanRevision(id, body),
    onSuccess: settled,
  });
}

export function useSetPlanStatus() {
  const settled = usePlanSettled();
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: PlanStatus; reason: string }) =>
      systemApi.setPlanStatus(id, status, reason),
    onSuccess: settled,
  });
}

export function useLinkPlanTrade() {
  const settled = usePlanSettled();
  return useMutation({
    mutationFn: ({ id, tradeId }: { id: string; tradeId: string }) =>
      systemApi.linkPlan(id, tradeId),
    onSuccess: settled,
  });
}

export function useUnlinkPlanTrade() {
  const settled = usePlanSettled();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      systemApi.unlinkPlan(id, reason),
    onSuccess: settled,
  });
}
