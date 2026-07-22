import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "../api/analytics";
import type { Filters } from "../api/types";

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

export function useBreakdown(by: string, filters: Filters) {
  return useQuery({
    queryKey: ["analytics", "breakdown", by, filters],
    queryFn: () => analyticsApi.breakdown(by, filters),
  });
}
