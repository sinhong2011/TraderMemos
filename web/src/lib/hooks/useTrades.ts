import { useQuery } from "@tanstack/react-query";
import { tradesApi } from "../api/trades";
import type { Filters } from "../api/types";

export function useTrades(filters: Filters) {
  return useQuery({ queryKey: ["trades", filters], queryFn: () => tradesApi.list(filters) });
}
