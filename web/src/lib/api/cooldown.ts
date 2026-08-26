import { apiFetch, qs } from "./client";
import type { Filters } from "./types";

/** What started a cooldown (api internal/cooldown). */
export type CooldownTrigger = "manual" | "loss_streak" | "daily_loss" | "trade_limit";
/** The urge named at the return gate. */
export type CooldownImpulse = "revenge" | "fomo" | "boredom" | "fear" | "validation";
/** The commitment made on the way back in. */
export type CooldownReturnRule = "none" | "half_size" | "one_trade" | "done_for_day";
export type CooldownPhase = "counting" | "gate" | "released";

/** One cooldown session (cooldown_handlers.go cooldownDTO). */
export interface Cooldown {
  id: string;
  started_at: string;
  ends_at: string;
  duration_sec: number;
  trigger: CooldownTrigger;
  impulse: CooldownImpulse | "";
  phase: CooldownPhase;
  released_at: string | null;
  released_early: boolean;
  setup_id: string | null;
  return_rule: CooldownReturnRule | "";
  reflection: string;
}

export interface ActiveCooldown {
  session: Cooldown | null;
}

export interface StartCooldownBody {
  duration_sec: number;
  trigger?: CooldownTrigger;
  impulse?: CooldownImpulse | "";
}

export interface ReleaseCooldownBody {
  impulse: CooldownImpulse | "";
  setup_id: string | null;
  return_rule: CooldownReturnRule;
  reflection: string;
}

export interface CooldownWindow {
  trades: number;
  wins: number;
  net_pnl: number;
  win_rate: number;
}

/** GET /analytics/cooldowns (cooldown.Stats). */
export interface CooldownStats {
  sessions: number;
  released: number;
  early_releases: number;
  early_release_rate: number;
  avg_minutes: number;
  by_trigger: Record<string, number>;
  by_impulse: Record<string, number>;
  by_rule: Record<string, number>;
  after_release: CooldownWindow;
  after_streak_no_cooldown: CooldownWindow;
  streak_n: number;
  return_rule_breaches: number;
}

export const cooldownApi = {
  active: () => apiFetch<ActiveCooldown>("/cooldowns/active"),
  start: (body: StartCooldownBody) =>
    apiFetch<Cooldown>("/cooldowns", { method: "POST", body: JSON.stringify(body) }),
  extend: (id: string, durationSec: number) =>
    apiFetch<Cooldown>(`/cooldowns/${id}/extend`, {
      method: "POST",
      body: JSON.stringify({ duration_sec: durationSec }),
    }),
  release: (id: string, body: ReleaseCooldownBody) =>
    apiFetch<Cooldown>(`/cooldowns/${id}/release`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  stats: (f: Filters) =>
    apiFetch<CooldownStats>(`/analytics/cooldowns${qs(f as Record<string, string | undefined>)}`),
};
