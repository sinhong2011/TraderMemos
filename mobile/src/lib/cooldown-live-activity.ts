/**
 * Cooldown Live Activity — the Lock Screen / Dynamic Island countdown. The
 * system draws the timer itself, so the app only starts the activity when a
 * session opens, flips it to the gate when the timer ends, and ends it on
 * release. The JSON here is the contract with `modules/live-activity`
 * (CooldownPayload) and `CooldownAttributes.swift`; dates travel as epoch
 * milliseconds for the same reason as the trading session.
 */
import { requireOptionalNativeModule } from 'expo-modules-core';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import type { Cooldown } from '@/api/types';
import { useCooldownClock, useCooldownLock } from '@/lib/cooldown';
import { useProUnlocked } from '@/lib/pro';

type CooldownActivityNative = {
  isSupported(): boolean;
  activeCooldownID(): string | null;
  startCooldown(json: string): boolean;
  updateCooldown(json: string): void;
  endCooldown(): void;
};

let cached: CooldownActivityNative | null | undefined;
function native(): CooldownActivityNative | null {
  if (cached !== undefined) return cached;
  cached =
    Platform.OS === 'ios'
      ? requireOptionalNativeModule<CooldownActivityNative>('LiveActivity')
      : null;
  // A dev build from before the cooldown functions shipped has the module
  // without them — treat it as unsupported rather than throwing on first use.
  if (cached && typeof cached.startCooldown !== 'function') cached = null;
  return cached;
}

function payload(session: Cooldown, phase: 'counting' | 'gate'): string {
  return JSON.stringify({
    schema: 1,
    sessionID: session.id,
    trigger: session.trigger,
    startedAt: Date.parse(session.started_at),
    endsAt: Date.parse(session.ends_at),
    phase,
  });
}

/**
 * Mounted once from the root layout (CooldownLiveActivityGate). Mirrors the
 * open session onto the Lock Screen and takes it off on release; reconciles
 * with ActivityKit on every return to foreground because the user can swipe
 * the activity away.
 */
export function useCooldownLiveActivitySync(): void {
  const unlocked = useProUnlocked('liveActivity');
  const { session } = useCooldownLock();
  const clock = useCooldownClock(session);
  const phase = clock.phase ?? 'gate';
  const lastPushed = useRef<string | null>(null);

  useEffect(() => {
    const mod = native();
    if (!mod) return;
    const sync = () => {
      if (!session || !unlocked) {
        if (mod.activeCooldownID() != null) mod.endCooldown();
        lastPushed.current = null;
        return;
      }
      const json = payload(session, phase);
      if (mod.activeCooldownID() !== session.id) {
        if (mod.startCooldown(json)) lastPushed.current = json;
        return;
      }
      if (lastPushed.current === json) return;
      lastPushed.current = json;
      mod.updateCooldown(json);
    };
    sync();
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') sync();
    });
    return () => subscription.remove();
  }, [session, unlocked, phase]);
}
