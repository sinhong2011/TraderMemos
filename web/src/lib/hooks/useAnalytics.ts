import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/lib/api/analytics";
import type { Filters } from "@/lib/api/types";

export function useSummary(filters: Filters) {
  return useQuery({
    queryKey: ["analytics", "summary", filters],
    queryFn: () => analyticsApi.summary(filters),
  });
}

export function useRSummary(filters: Filters) {
  return useQuery({
    queryKey: ["analytics", "r-summary", filters],
    queryFn: () => analyticsApi.rSummary(filters),
  });
}

export function useEquityCurve(filters: Filters) {
  return useQuery({
    queryKey: ["analytics", "equity-curve", filters],
    queryFn: () => analyticsApi.equityCurve(filters),
  });
}

export function useDailyPnl(filters: Filters) {
  return useQuery({
    queryKey: ["analytics", "daily", filters],
    queryFn: () => analyticsApi.daily(filters),
  });
}

export function useCompliance(filters: Filters, enabled = true) {
  return useQuery({
    queryKey: ["analytics", "compliance", filters],
    queryFn: () => analyticsApi.compliance(filters),
    enabled,
  });
}

export function useBehavior(filters: Filters, enabled = true) {
  return useQuery({
    queryKey: ["analytics", "behavior", filters],
    queryFn: () => analyticsApi.behavior(filters),
    enabled,
  });
}

export function useMonteCarlo(filters: Filters, enabled = true) {
  return useQuery({
    queryKey: ["analytics", "montecarlo", filters],
    queryFn: () => analyticsApi.monteCarlo(filters),
    enabled,
  });
}

export function useBreakdown(by: string, filters: Filters) {
  return useQuery({
    queryKey: ["analytics", "breakdown", by, filters],
    queryFn: () => analyticsApi.breakdown(by, filters),
  });
}
