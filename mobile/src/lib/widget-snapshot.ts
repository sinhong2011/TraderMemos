/**
 * Home/Lock Screen widget snapshot — the app side of the WidgetKit pipeline.
 *
 * The widget extension never talks to the API; it renders whatever this hook
 * last wrote into the shared App Group through `modules/widget-bridge`. The
 * JSON shape is the contract with `targets/widgets/TodaySnapshot.swift` —
 * change them in lockstep and bump the key suffix in both natives.
 *
 * The numbers come from `lib/today-state.ts` (shared with the Live Activity):
 * money already FX-converted into the display currency, so the widget only
 * formats. Day-rollover is the widget's job (it compares `dayKey` against its
 * own clock in `marketTimezone`), which keeps a stale snapshot honest at
 * market midnight without the app running.
 */

import { requireOptionalNativeModule } from 'expo-modules-core';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { useSession } from '@/api/session';
import { useProUnlocked } from '@/lib/pro';
import { useTodayState } from '@/lib/today-state';

type WidgetBridge = {
  setSnapshot(json: string): void;
  clearSnapshot(): void;
};

let cached: WidgetBridge | null | undefined;
function bridge(): WidgetBridge | null {
  if (cached !== undefined) return cached;
  // Optional, not required: a dev build made before this module shipped (or
  // Android, where there is no widget yet) must degrade to a no-op, not throw.
  cached = Platform.OS === 'ios' ? requireOptionalNativeModule<WidgetBridge>('WidgetBridge') : null;
  return cached;
}

/**
 * Mounted once from the root layout (WidgetSnapshotGate). Pushes a snapshot
 * whenever the derived numbers actually change; sign-out clears it so a Lock
 * Screen never shows P&L for a dead session.
 */
export function useWidgetSnapshotSync(): void {
  const { session } = useSession();
  const unlocked = useProUnlocked('widgets');
  const {
    ready,
    todayKey,
    marketTz,
    currency,
    todayNetPnl,
    openPositions,
    dailyLossLimit,
    maxRiskPerTrade,
    privacyMode,
  } = useTodayState();

  const lastPushed = useRef<string | null>(null);

  useEffect(() => {
    const native = bridge();
    if (!native) return;

    if (!session || !unlocked) {
      if (lastPushed.current !== 'cleared') {
        native.clearSnapshot();
        lastPushed.current = 'cleared';
      }
      return;
    }
    // Never overwrite a good snapshot with zeros while queries are loading —
    // the widget keeps last night's numbers, same as the MMKV persister.
    if (!ready) return;

    const body = {
      schema: 1,
      dayKey: todayKey,
      marketTimezone: marketTz,
      currency,
      todayNetPnl,
      openPositions,
      dailyLossLimit,
      maxRiskPerTrade,
      privacyMode,
    };
    // Dedupe on the data, not the timestamp — every push costs the widget a
    // timeline reload, and WidgetKit budgets those.
    const key = JSON.stringify(body);
    if (lastPushed.current === key) return;
    lastPushed.current = key;
    native.setSnapshot(JSON.stringify({ ...body, generatedAt: new Date().toISOString() }));
  }, [
    session,
    unlocked,
    ready,
    todayKey,
    marketTz,
    currency,
    todayNetPnl,
    openPositions,
    dailyLossLimit,
    maxRiskPerTrade,
    privacyMode,
  ]);
}
