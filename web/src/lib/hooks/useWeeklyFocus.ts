import { useQuery } from "@tanstack/react-query";
import { focusApi } from "@/lib/api/focus";

export function useWeeklyFocus() {
  return useQuery({
    queryKey: ["focus", "current"],
    queryFn: () => focusApi.current(),
  });
}
