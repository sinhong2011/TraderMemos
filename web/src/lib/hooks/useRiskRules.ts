import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type RiskRules, settingsApi } from "@/lib/api/settings";

export function useRiskRules() {
  return useQuery({
    queryKey: ["settings", "risk-rules"],
    queryFn: () => settingsApi.getRiskRules(),
  });
}

export function useSaveRiskRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RiskRules) => settingsApi.putRiskRules(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["settings", "risk-rules"] });
    },
  });
}
