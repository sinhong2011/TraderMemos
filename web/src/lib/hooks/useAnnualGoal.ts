import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type AnnualGoal, settingsApi } from "@/lib/api/settings";

export function useAnnualGoal(year: number) {
  return useQuery({
    queryKey: ["settings", "annual-goal", year],
    queryFn: () => settingsApi.getAnnualGoal(year),
  });
}

export function useSaveAnnualGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { year: number; amount: number }) => settingsApi.putAnnualGoal(body),
    onSuccess: (data: AnnualGoal) => {
      void qc.invalidateQueries({ queryKey: ["settings", "annual-goal", data.year] });
    },
  });
}

export function useClearAnnualGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (year: number) => settingsApi.deleteAnnualGoal(year),
    onSuccess: (data: AnnualGoal) => {
      void qc.invalidateQueries({ queryKey: ["settings", "annual-goal", data.year] });
    },
  });
}
