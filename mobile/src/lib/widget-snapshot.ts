/**
 * Home/Lock Screen widget snapshot — the app side of the WidgetKit pipeline.
 *
 * The widget extension never talks to the API; it renders whatever this hook
 * last wrote into the shared App Group through `modules/widget-bridge`. The
 * JSON shape is the contract with `targets/widgets/TodaySnapshot.swift` —
 * change them in lockstep and bump the key suffix in both natives.
 *
 * Money is FX-converted into the display currency *here*, so the widget only
 * formats. Day-rollover is the widget's job (it compares `dayKey` against its
 * own clock in `marketTimezone`), which keeps a stale snapshot honest at
 * market midnight without the app running.
 */

import { requireOptionalNativeModule } from 'expo-modules-core';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { useAccounts, useDaily, useRiskRules, useTrades } from '@/api/hooks';
import { useSession } from '@/api/session';
import { useSelectedAccountId } from '@/lib/account-store';
import { dayKeyInTz } from '@/lib/events';
import { useGlobalFilters } from '@/lib/filters';
import { useMoneyFx } from '@/lib/money';
import { accountBaseCurrency, resolveMarketTimezone, useDisplayPrefs } from '@/lib/prefs';
import { useProUnlocked } from '@/lib/pro';

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
 * Mounted once from the root layout (WidgetSnapshotGate). Reuses the
 * dashboard's own queries — same keys, same cache — and pushes a snapshot
 * whenever the derived numbers actually change; sign-out clears it so a Lock
 * Screen never shows P&L for a dead session.
 */
export function useWidgetSnapshotSync(): void {
  const { session } = useSession();
  const unlocked = useProUnlocked('widgets');
  const filters = useGlobalFilters();
  const { privacyMode, marketTimezone } = useDisplayPrefs();

  // Identical `from` string to the dashboard's daily query so the two share
  // one cache entry.
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01T00:00:00Z`;
  const daily = useDaily({ ...filters, from: monthStart });
  // Positions, not a daily figure — status-scoped, never date-scoped.
  const openTrades = useTrades({ ...filters, status: 'open' });
  const riskRules = useRiskRules();
  const accounts = useAccounts();
  const selectedAccountId = useSelectedAccountId();
  const fx = useMoneyFx(accountBaseCurrency(accounts.data, selectedAccountId));

  const marketTz = resolveMarketTimezone(marketTimezone);
  const todayKey = dayKeyInTz(new Date().toISOString(), marketTz);
  const openPositions = openTrades.data?.length ?? 0;
  const ready = daily.data != null && openTrades.data != null;
  const currency = fx.currency;
  // Converted during render so the effect depends on stable primitives, not
  // on the fresh `toDisplay` closure useMoneyFx returns each render.
  const todayNetPnl = fx.toDisplay(daily.data?.[todayKey] ?? 0);
  const cap = riskRules.data?.max_daily_loss;
  const dailyLossLimit = cap != null && cap > 0 ? fx.toDisplay(cap) : null;
  const risk = riskRules.data?.max_risk_per_trade;
  const maxRiskPerTrade = risk != null && risk > 0 ? fx.toDisplay(risk) : null;

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
