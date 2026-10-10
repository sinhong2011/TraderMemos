import { useQuery } from "@tanstack/react-query";
import { focusApi } from "@/lib/api/focus";
import type { Filters } from "@/lib/api/types";

export function useWeeklyFocus() {
  return useQuery({
    queryKey: ["focus", "current"],
    queryFn: () => focusApi.current(),
  });
}

/** Past focus, scored from each weekly review's checklist. Notes invalidate ["focus"]. */
export function useFocusHistory(filters: Pick<Filters, "from" | "to">) {
  return useQuery({
    queryKey: ["focus", "history", filters.from ?? "", filters.to ?? ""],
    queryFn: () => focusApi.history(filters),
  });
}
