/**
 * Cooldown mode — the pause a trader takes before the next trade decides for
 * them. The server owns the session (`/cooldowns`); this is the web app's
 * vocabulary for it, mirroring `mobile/src/lib/cooldown.ts`: the duration
 * ladder, the impulses and return rules, a one-second clock, and the tab
 * title that keeps counting in another tab.
 */
import { useEffect, useState } from "react";
import type {
  Cooldown,
  CooldownImpulse,
  CooldownReturnRule,
  CooldownTrigger,
} from "./api/cooldown";
import { useActiveCooldown } from "./hooks/useCooldown";
import { useRiskRules } from "./hooks/useRiskRules";

export const COOLDOWN_DURATIONS = [2, 5, 15, 30, 60] as const;
export const DEFAULT_COOLDOWN_MINUTES = 15;
export const EXTEND_MINUTES = 5;
/** Shortest reflection the server accepts for an early release. */
export const MIN_REFLECTION = 40;

export const IMPULSES: readonly { value: CooldownImpulse; label: string }[] = [
  { value: "revenge", label: "Revenge" },
  { value: "fomo", label: "FOMO" },
  { value: "boredom", label: "Boredom" },
  { value: "fear", label: "Fear" },
  { value: "validation", label: "Proving myself" },
];

export const RETURN_RULES: readonly {
  value: CooldownReturnRule;
  label: string;
  detail: string;
}[] = [
  { value: "none", label: "No rule", detail: "Trade as planned." },
  { value: "half_size", label: "Half size", detail: "Risk no more than half your usual." },
  { value: "one_trade", label: "One trade", detail: "One more today, then stop." },
  { value: "done_for_day", label: "Done for today", detail: "No more trades until tomorrow." },
];

export function returnRuleLabel(value: string): string {
  return RETURN_RULES.find((r) => r.value === value)?.label ?? value;
}

export function triggerSentence(trigger: CooldownTrigger): string {
  switch (trigger) {
    case "loss_streak":
      return "You hit your loss streak limit.";
    case "daily_loss":
      return "You hit your daily loss limit.";
    case "trade_limit":
      return "You hit your trades-per-day cap.";
    default:
      return "You chose to step away.";
  }
}

export function triggerLabel(trigger: CooldownTrigger): string {
  switch (trigger) {
    case "loss_streak":
      return "Loss streak";
    case "daily_loss":
      return "Daily loss";
    case "trade_limit":
      return "Trade cap";
    default:
      return "Manual";
  }
}

/** `m:ss`, or `h:mm:ss` past an hour. */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`;
}

function remainingSeconds(session: Cooldown | null | undefined, now: number): number {
  if (!session) return 0;
  return Math.max(0, Math.ceil((Date.parse(session.ends_at) - now) / 1000));
}

/**
 * A one-second clock over the session. `phase` is derived locally so the
 * face flips to the gate the moment the timer ends, without a refetch.
 */
export function useCooldownClock(session: Cooldown | null | undefined): {
  remaining: number;
  phase: "counting" | "gate" | null;
} {
  const [now, setNow] = useState(() => Date.now());
  const endsAt = session?.ends_at;
  useEffect(() => {
    if (!endsAt) return;
    const update = () => setNow(Date.now());
    const first = window.setTimeout(update, 0);
    const id = window.setInterval(update, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [endsAt]);
  if (!session) return { remaining: 0, phase: null };
  const remaining = remainingSeconds(session, now);
  return { remaining, phase: remaining > 0 ? "counting" : "gate" };
}

/**
 * Cooldown mode's master switch (risk_rules.cooldown_enabled). Off by default
 * and while the rules are still loading, so no cooldown surface flashes in
 * before the answer arrives.
 */
export function useCooldownEnabled(): boolean {
  const { data } = useRiskRules();
  return data?.cooldown_enabled === true;
}

/** The lock every trade-entry surface checks. Unknown reads as unlocked. */
export function useCooldownLock(): { locked: boolean; session: Cooldown | null } {
  const { data } = useActiveCooldown();
  const session = data?.session ?? null;
  return { locked: session != null, session };
}

const TITLE_SUFFIX = "TraderMemos";

/**
 * Keeps the countdown in the tab title, so a trader who switched to the
 * broker's tab still sees the clock. Restores the previous title when the
 * session closes.
 */
export function useCooldownTitle(): void {
  const { session } = useCooldownLock();
  const { remaining, phase } = useCooldownClock(session);
  useEffect(() => {
    if (!session) return;
    const previous = document.title;
    document.title =
      phase === "gate"
        ? `Cooldown over — answer the gate · ${TITLE_SUFFIX}`
        : `⏸ ${formatCountdown(remaining)} · ${TITLE_SUFFIX}`;
    return () => {
      document.title =
        previous.startsWith("⏸") || previous.startsWith("Cooldown over") ? TITLE_SUFFIX : previous;
    };
  }, [session, remaining, phase]);
}
