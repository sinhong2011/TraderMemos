import { useQuery } from "@tanstack/react-query";
import { tradesApi } from "@/lib/api/trades";
import type { Filters } from "@/lib/api/types";

export function useTrades(filters: Filters) {
  return useQuery({
    queryKey: ["trades", filters],
    queryFn: () => tradesApi.list(filters),
  });
}
