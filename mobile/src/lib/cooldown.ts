/**
 * Cooldown mode — the pause a trader takes before the next trade decides for
 * them. The server owns the session (`/cooldowns`, see api/internal/cooldown);
 * this module is the app's vocabulary for it: the duration and impulse
 * choices, the return rules, a one-second clock over the active session, and
 * the mutations every surface (screen, banner, Home card, trade gate) shares.
 *
 * Locking is a client contract: while a session is open the trade form
 * redirects here and the Trades "+" opens this screen instead. Reading the
 * journal stays free — the lock is on acting, not on looking.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { queryKeys, useActiveCooldown, useApiRequest, useRiskRules } from '@/api/hooks';
import type {
  Cooldown,
  CooldownImpulse,
  CooldownReturnRule,
  CooldownTrigger,
} from '@/api/types';
import { t } from '@lingui/core/macro';

/** Minutes offered on the start face — the reference protocol's ladder. */
export const COOLDOWN_DURATIONS = [2, 5, 15, 30, 60] as const;
export const DEFAULT_COOLDOWN_MINUTES = 15;
/** One tap on the counting face adds this much. */
export const EXTEND_MINUTES = 5;
/** Shortest reflection the server accepts for an early release (cooldown.go). */
export const MIN_REFLECTION = 40;

export const IMPULSES: readonly { value: CooldownImpulse; label: () => string }[] = [
  { value: 'revenge', label: () => t`Revenge` },
  { value: 'fomo', label: () => t`FOMO` },
  { value: 'boredom', label: () => t`Boredom` },
  { value: 'fear', label: () => t`Fear` },
  { value: 'validation', label: () => t`Proving myself` },
];

export const RETURN_RULES: readonly {
  value: CooldownReturnRule;
  label: () => string;
  detail: () => string;
}[] = [
  { value: 'none', label: () => t`No rule`, detail: () => t`Trade as planned.` },
  {
    value: 'half_size',
    label: () => t`Half size`,
    detail: () => t`Risk no more than half your usual.`,
  },
  {
    value: 'one_trade',
    label: () => t`One trade`,
    detail: () => t`One more today, then stop.`,
  },
  {
    value: 'done_for_day',
    label: () => t`Done for today`,
    detail: () => t`No more trades until tomorrow.`,
  },
];

export function impulseLabel(value: CooldownImpulse | ''): string {
  return IMPULSES.find((i) => i.value === value)?.label() ?? '';
}

export function returnRuleLabel(value: CooldownReturnRule | ''): string {
  return RETURN_RULES.find((r) => r.value === value)?.label() ?? '';
}

/** Why this session started, as a sentence for the counting face. */
export function triggerSentence(trigger: CooldownTrigger): string {
  switch (trigger) {
    case 'loss_streak':
      return t`You hit your loss streak limit.`;
    case 'daily_loss':
      return t`You hit your daily loss limit.`;
    case 'trade_limit':
      return t`You hit your trades-per-day cap.`;
    default:
      return t`You chose to step away.`;
  }
}

export function triggerLabel(trigger: CooldownTrigger): string {
  switch (trigger) {
    case 'loss_streak':
      return t`Loss streak`;
    case 'daily_loss':
      return t`Daily loss`;
    case 'trade_limit':
      return t`Trade cap`;
    default:
      return t`Manual`;
  }
}

/** `mm:ss`, or `h:mm:ss` past an hour. */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
}

function remainingSeconds(session: Cooldown | null | undefined, now: number): number {
  if (!session) return 0;
  return Math.max(0, Math.ceil((Date.parse(session.ends_at) - now) / 1000));
}

/**
 * A one-second clock over the session. `phase` is derived locally so the
 * face flips to the gate the moment the timer ends, without a refetch; the
 * server re-derives it on release anyway.
 */
export function useCooldownClock(session: Cooldown | null | undefined): {
  remaining: number;
  phase: 'counting' | 'gate' | null;
} {
  const [now, setNow] = useState(() => Date.now());
  const endsAt = session?.ends_at;
  useEffect(() => {
    if (!endsAt) return;
    const update = () => setNow(Date.now());
    // The first read lands on the next tick rather than inside the effect
    // body (react-hooks/set-state-in-effect); a session that just arrived
    // shows its true remaining time a frame later, not a second later.
    const first = setTimeout(update, 0);
    const id = setInterval(update, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [endsAt]);
  if (!session) return { remaining: 0, phase: null };
  const remaining = remainingSeconds(session, now);
  return { remaining, phase: remaining > 0 ? 'counting' : 'gate' };
}

/**
 * Cooldown mode's master switch (risk_rules.cooldown_enabled). Off by
 * default and while the rules are still loading, so no cooldown surface ever
 * flashes in before the answer arrives.
 */
export function useCooldownEnabled(): boolean {
  const { data } = useRiskRules();
  return data?.cooldown_enabled === true;
}

/**
 * The lock every trade-entry surface checks. Unknown (still loading, no
 * cache) reads as unlocked — the gate exists to stop a tilted trader, not to
 * block a cold start on a slow link.
 */
export function useCooldownLock(): { locked: boolean; session: Cooldown | null } {
  const { data } = useActiveCooldown();
  const session = data?.session ?? null;
  return { locked: session != null, session };
}

export type StartCooldownBody = {
  duration_sec: number;
  trigger?: CooldownTrigger;
  impulse?: CooldownImpulse | '';
};

export type ReleaseCooldownBody = {
  impulse: CooldownImpulse | '';
  setup_id: string | null;
  return_rule: CooldownReturnRule;
  reflection: string;
};

/** Start / extend / release, each refreshing the active-session query. */
export function useCooldownActions() {
  const api = useApiRequest();
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.activeCooldown() });

  const start = useMutation({
    mutationFn: (body: StartCooldownBody) =>
      api<Cooldown>('/cooldowns', { method: 'POST', body }),
    onSettled: () => void refresh(),
  });
  const extend = useMutation({
    mutationFn: ({ id, minutes }: { id: string; minutes: number }) =>
      api<Cooldown>(`/cooldowns/${id}/extend`, {
        method: 'POST',
        body: { duration_sec: minutes * 60 },
      }),
    onSettled: () => void refresh(),
  });
  const release = useMutation({
    mutationFn: ({ id, body }: { id: string; body: ReleaseCooldownBody }) =>
      api<Cooldown>(`/cooldowns/${id}/release`, { method: 'POST', body }),
    onSettled: () => {
      void refresh();
      // A return rule changes how compliance scores today.
      void queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
  return { start, extend, release };
}
