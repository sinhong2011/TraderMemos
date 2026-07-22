import { useQuery } from "@tanstack/react-query";
import { apiHealthUrl, getBaseUrl } from "../api/client";

export type ApiHealth = {
  status: string;
  version?: string;
  commit?: string;
  go?: string;
};

export async function fetchApiHealth(): Promise<ApiHealth> {
  const res = await fetch(apiHealthUrl(getBaseUrl()));
  if (!res.ok) {
    throw new Error(`Health check failed (${res.status})`);
  }
  return res.json() as Promise<ApiHealth>;
}

export function useApiHealth() {
  const apiBase = getBaseUrl();
  return useQuery({
    queryKey: ["api-health", apiBase],
    queryFn: fetchApiHealth,
    staleTime: 30_000,
    retry: 1,
  });
}
