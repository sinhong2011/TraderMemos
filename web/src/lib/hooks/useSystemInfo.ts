import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";

export type SystemInfo = {
  version: string;
  commit?: string;
  build_time?: string;
  go: string;
  started_at: string;
  uptime_sec: number;
  db_driver?: string;
  features: Record<string, boolean>;
};

/** Compact uptime like "3d 4h", "2h 15m", or "5m". */
export function formatUptime(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const days = Math.floor(sec / 86_400);
  const hours = Math.floor((sec % 86_400) / 3_600);
  const minutes = Math.floor((sec % 3_600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function useSystemInfo() {
  return useQuery({
    queryKey: ["system-info"],
    queryFn: () => apiFetch<SystemInfo>("/system/info"),
    staleTime: 30_000,
    retry: 1,
  });
}
