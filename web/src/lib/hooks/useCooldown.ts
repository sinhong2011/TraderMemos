import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cooldownApi, type ReleaseCooldownBody, type StartCooldownBody } from "@/lib/api/cooldown";
import type { Filters } from "@/lib/api/types";

const ACTIVE_KEY = ["cooldowns", "active"] as const;

/**
 * The cooldown currently locking trade entry. Never trusted stale and polled
 * while the tab is open: the server starts sessions on its own when a risk
 * rule trips (a broker sync can land the losing fill), and the lock has to
 * show up without a click.
 */
export function useActiveCooldown() {
  return useQuery({
    queryKey: ACTIVE_KEY,
    queryFn: () => cooldownApi.active(),
    staleTime: 0,
    refetchInterval: 30_000,
  });
}

export function useStartCooldown() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: StartCooldownBody) => cooldownApi.start(body),
    onSettled: () => void qc.invalidateQueries({ queryKey: ACTIVE_KEY }),
  });
}

export function useExtendCooldown() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, minutes }: { id: string; minutes: number }) =>
      cooldownApi.extend(id, minutes * 60),
    onSettled: () => void qc.invalidateQueries({ queryKey: ACTIVE_KEY }),
  });
}

export function useReleaseCooldown() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ReleaseCooldownBody }) =>
      cooldownApi.release(id, body),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ACTIVE_KEY });
      // A return rule changes how compliance scores today.
      void qc.invalidateQueries({ queryKey: ["analytics"] });
    },
  });
}

export function useCooldownStats(filters: Filters, enabled = true) {
  return useQuery({
    queryKey: ["analytics", "cooldowns", filters],
    queryFn: () => cooldownApi.stats(filters),
    enabled,
  });
}
