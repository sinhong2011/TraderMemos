/**
 * The app side of the routine / missed-trade iOS surfaces — the Daily Routine
 * and Missed Trades widgets, the Control Center controls, and the Siri /
 * Shortcuts intents (targets/shared/, targets/widgets/).
 *
 * Unlike the Today widget these write on their own: a widget checkbox or
 * "check off … in TraderMemos" PUTs straight to the server from Swift. So
 * the app hands over three things through `modules/widget-bridge`:
 *
 * - the session (server URL + token pair) into a keychain item shared with
 *   the extension — refresh tokens are stateless JWTs, so the Swift side
 *   refreshing on its own never signs the app out;
 * - today's routine and the missed-trade summary, as the snapshot a widget
 *   shows when it can't reach the server;
 * - the market timezone: the routine's day is the market day (checklist.ts
 *   routineDay), and the Swift side has to key "today" the same way when Siri
 *   or a control ticks without the app;
 * - and it takes back the ticks that couldn't be sent, replaying them through
 *   the outbox, then refetches — a tick made from the Home Screen changed the
 *   server under the app's cache.
 */

import { useQueryClient } from '@tanstack/react-query';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { queryKeys, useApiRequest, useMissedSummary, useRoutineDay } from '@/api/hooks';
import { useSession } from '@/api/session';
import { useRoutineToday } from '@/lib/checklist';
import { applyPendingChecks, drainOutbox, enqueueRoutineCheck, usePendingOps } from '@/lib/outbox';
import { resolveMarketTimezone, useDisplayPrefs } from '@/lib/prefs';
import { useProUnlocked } from '@/lib/pro';

type RoutineBridge = {
  setCredentials(serverUrl: string, accessToken: string, refreshToken: string): void;
  clearRoutine(): void;
  setRoutine(json: string): void;
  setMissed(json: string): void;
  takePendingChecks(): string;
  /** Absent from dev builds made before the routine moved to the market day. */
  setMarketTimezone?(timeZone: string): void;
};

let cached: RoutineBridge | null | undefined;
function bridge(): RoutineBridge | null {
  if (cached !== undefined) return cached;
  const native =
    Platform.OS === 'ios' ? requireOptionalNativeModule<Partial<RoutineBridge>>('WidgetBridge') : null;
  // A dev build from before these functions shipped has the module without
  // them: degrade to a no-op rather than throw.
  cached = native?.setRoutine ? (native as RoutineBridge) : null;
  return cached;
}

type PendingCheck = { day: string; id: string; done: boolean };

/** Mounted once from the root layout, beside the Today widget's sync. */
export function useWidgetRoutineSync(): void {
  const { session } = useSession();
  const unlocked = useProUnlocked('widgets');
  const api = useApiRequest();
  const queryClient = useQueryClient();
  const { day: today } = useRoutineToday();
  const { marketTimezone } = useDisplayPrefs();
  const marketTz = resolveMarketTimezone(marketTimezone);
  const day = useRoutineDay(today);
  const missed = useMissedSummary();
  const pendingOps = usePendingOps();
  const active = session != null && unlocked;

  const pushed = useRef<{ creds?: string; routine?: string; missed?: string; tz?: string }>({});

  // The zone the Swift side keys "today" by. Pushed signed in or not: it is a
  // setting, not account data. A change re-keys every surface at once.
  useEffect(() => {
    const native = bridge();
    if (!native?.setMarketTimezone || pushed.current.tz === marketTz) return;
    pushed.current.tz = marketTz;
    native.setMarketTimezone(marketTz);
  }, [marketTz]);

  // Session in, or everything out on sign-out.
  useEffect(() => {
    const native = bridge();
    if (!native) return;
    if (!active) {
      if (pushed.current.creds !== 'cleared') {
        native.clearRoutine();
        pushed.current = { creds: 'cleared' };
      }
      return;
    }
    const key = `${session.serverUrl}|${session.accessToken}|${session.refreshToken}`;
    if (pushed.current.creds === key) return;
    pushed.current.creds = key;
    native.setCredentials(session.serverUrl, session.accessToken, session.refreshToken);
  }, [active, session]);

  // Today's routine, queued ticks included — the widget shows what the app does.
  const routine = applyPendingChecks(day.data, pendingOps);
  const routineJson =
    active && routine
      ? JSON.stringify({
          schema: 1,
          day: routine.day,
          items: routine.items.map((item) => ({
            id: item.id,
            title: item.title,
            stage: item.stage,
            done: item.done,
          })),
        })
      : null;
  useEffect(() => {
    const native = bridge();
    if (!native || routineJson == null || pushed.current.routine === routineJson) return;
    pushed.current.routine = routineJson;
    native.setRoutine(routineJson);
  }, [routineJson]);

  const summary = missed.data;
  const missedJson =
    active && summary
      ? JSON.stringify({
          schema: 1,
          count: summary.count,
          scored: summary.scored,
          net_r: summary.net_r,
          unknown: summary.outcomes.unknown ?? 0,
        })
      : null;
  useEffect(() => {
    const native = bridge();
    if (!native || missedJson == null || pushed.current.missed === missedJson) return;
    pushed.current.missed = missedJson;
    native.setMissed(missedJson);
  }, [missedJson]);

  // Back from the Home Screen: take over what the widget couldn't send, and
  // refetch what it (or Siri) did send.
  useEffect(() => {
    const native = bridge();
    if (!native || !active) return;
    const pull = (refetch: boolean) => {
      let checks: PendingCheck[] = [];
      try {
        checks = JSON.parse(native.takePendingChecks()) as PendingCheck[];
      } catch {
        checks = [];
      }
      for (const check of checks) enqueueRoutineCheck(check.day, check.id, check.done);
      if (checks.length > 0) void drainOutbox(api, queryClient);
      if (!refetch) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.routines() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.missedTrades() });
    };
    // A cold start fetches anyway; only a return from the background needs
    // the nudge.
    pull(false);
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') pull(true);
    });
    return () => subscription.remove();
  }, [active, api, queryClient]);
}
