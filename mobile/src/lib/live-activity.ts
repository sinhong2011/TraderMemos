/**
 * Trading-session Live Activity — the app side of the ActivityKit pipeline
 * (roadmap #134, Pro candidate #2 in docs/mobile-monetization-plan.md).
 *
 * The user puts today's session on the Lock Screen from the Home tools menu;
 * while the app runs, `useTradingSessionSync` (LiveActivityGate in the root
 * layout) feeds it the same `lib/today-state.ts` numbers the widgets render.
 * There is no push channel — the activity is marked stale at market midnight
 * (`staleAt`) so an abandoned Lock Screen dims instead of lying, and the next
 * app launch on a new market day ends it outright.
 *
 * The JSON here is the contract with `modules/live-activity` (SessionPayload)
 * and `TradingSessionAttributes.swift` — change them in lockstep. Dates
 * travel as epoch milliseconds; see the native module for why not ISO.
 */

import { requireOptionalNativeModule } from 'expo-modules-core';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { useSession } from '@/api/session';
import { dayKeyInTz } from '@/lib/events';
import { useProUnlocked } from '@/lib/pro';
import { useTodayState, type TodayState } from '@/lib/today-state';
import { mmkvStorage } from '@/storage/zustand-mmkv';

type LiveActivityNative = {
  isSupported(): boolean;
  isActive(): boolean;
  startSession(json: string): boolean;
  updateSession(json: string): void;
  endSession(): void;
};

let cached: LiveActivityNative | null | undefined;
function native(): LiveActivityNative | null {
  if (cached !== undefined) return cached;
  // Optional, not required: Android and dev builds made before this module
  // shipped must degrade to a no-op, not throw.
  cached =
    Platform.OS === 'ios' ? requireOptionalNativeModule<LiveActivityNative>('LiveActivity') : null;
  return cached;
}

/**
 * `active` mirrors ActivityKit (reconciled on launch and foreground — the
 * user can swipe the activity away without telling us). `dayKey` is the
 * market day the session was started for, persisted so a relaunch on a later
 * day knows the surviving activity is yesterday's and ends it.
 */
type SessionStore = { active: boolean; dayKey: string | null };

const useSessionStore = create<SessionStore>()(
  persist((): SessionStore => ({ active: false, dayKey: null }), {
    name: 'store:trading-session',
    storage: mmkvStorage<SessionStore>(),
    partialize: (state) => ({ ...state, active: false }),
  }),
);

/** First instant after now whose market-tz day key moves past `todayKey`. */
function nextMarketMidnightMs(todayKey: string, marketTz: string): number {
  let lo = Date.now();
  let hi = lo + 48 * 3_600_000;
  // Binary search to the minute — DST-proof because dayKeyInTz is the same
  // bucketing every other surface uses.
  while (hi - lo > 60_000) {
    const mid = (lo + hi) / 2;
    if (dayKeyInTz(new Date(mid).toISOString(), marketTz) === todayKey) lo = mid;
    else hi = mid;
  }
  return Math.round(hi);
}

function sessionPayload(state: TodayState): string {
  return JSON.stringify({
    schema: 1,
    dayKey: state.todayKey,
    marketTimezone: state.marketTz,
    staleAt: nextMarketMidnightMs(state.todayKey, state.marketTz),
    state: {
      pnl: state.todayNetPnl,
      tradesTaken: state.tradesToday ?? 0,
      openPositions: state.openPositions,
      currency: state.currency,
      dailyLossLimit: state.dailyLossLimit,
      maxRiskPerTrade: state.maxRiskPerTrade,
      privacyMode: state.privacyMode,
    },
  });
}

/**
 * The tools-menu control. `supported` folds in platform, the user's
 * per-app Live Activities toggle, session, and the Pro seam — when false the
 * menu simply doesn't offer the item.
 */
export function useTradingSession(): {
  supported: boolean;
  active: boolean;
  start: () => void;
  end: () => void;
} {
  const { session } = useSession();
  const unlocked = useProUnlocked('liveActivity');
  const state = useTodayState();
  const active = useSessionStore((store) => store.active);

  const start = () => {
    const mod = native();
    // Queries still loading — the menu item is reachable a beat before the
    // dashboard settles; starting with zeros would flash a wrong session.
    if (!mod || !state.ready) return;
    if (mod.startSession(sessionPayload(state))) {
      useSessionStore.setState({ active: true, dayKey: state.todayKey });
    }
  };

  const end = () => {
    native()?.endSession();
    useSessionStore.setState({ active: false, dayKey: null });
  };

  return {
    supported: session != null && unlocked && (native()?.isSupported() ?? false),
    active,
    start,
    end,
  };
}

/**
 * Mounted once from the root layout (LiveActivityGate). While a session is
 * active, mirrors the derived numbers into the activity; ends it on
 * sign-out, on the Pro gate closing, and on the first run of a new market
 * day (the activity itself went stale at midnight via `staleAt`).
 */
export function useTradingSessionSync(): void {
  const { session } = useSession();
  const unlocked = useProUnlocked('liveActivity');
  const state = useTodayState();
  const active = useSessionStore((store) => store.active);
  const startedDayKey = useSessionStore((store) => store.dayKey);

  // Reconcile with ActivityKit on launch and every return to foreground.
  useEffect(() => {
    const mod = native();
    if (!mod) return;
    const reconcile = () => {
      const alive = mod.isActive();
      if (useSessionStore.getState().active !== alive) {
        useSessionStore.setState(alive ? { active: true } : { active: false, dayKey: null });
      }
    };
    reconcile();
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') reconcile();
    });
    return () => subscription.remove();
  }, []);

  const lastPushed = useRef<string | null>(null);

  useEffect(() => {
    const mod = native();
    if (!mod || !active) return;

    // The session outlived its authorization or its market day — take it off
    // the Lock Screen rather than letting a dead number sit there.
    if (!session || !unlocked || (startedDayKey != null && startedDayKey !== state.todayKey)) {
      mod.endSession();
      useSessionStore.setState({ active: false, dayKey: null });
      return;
    }
    if (!state.ready || state.tradesToday == null) return;

    // Dedupe on the data — ActivityKit throttles updates the same way
    // WidgetKit budgets timeline reloads.
    const json = sessionPayload(state);
    if (lastPushed.current === json) return;
    lastPushed.current = json;
    mod.updateSession(json);
  }, [session, unlocked, active, startedDayKey, state]);
}
