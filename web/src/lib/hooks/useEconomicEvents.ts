import { useQuery } from "@tanstack/react-query";
import { economicEventsApi } from "../api/economicEvents";

/**
 * Macro calendar events for a date range (YYYY-MM-DD or RFC3339 bounds).
 * Impact/currency filtering happens client-side so one fetch serves all
 * filter combinations for the week.
 */
export function useEconomicEvents(params: { from: string; to: string }) {
  return useQuery({
    queryKey: ["economic-events", params.from, params.to],
    queryFn: () => economicEventsApi.list(params),
    staleTime: 5 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
