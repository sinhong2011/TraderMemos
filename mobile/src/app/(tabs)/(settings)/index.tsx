import { useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import type { SFSymbol } from 'expo-symbols';
import { Alert, Linking } from 'react-native';

import { useAccounts, useApiRequest, useCash, useMe, useTrades } from '@/api/hooks';
import { AccountRow } from '@/components/account-row';
import { CenteredButton } from '@/components/centered-button';
import { NavRow } from '@/components/nav-row';
import { FloatingSearchBar, SearchToggle } from '@/components/search-bar';
import { SettingsForm } from '@/components/settings-form';
import {
  SettingsButton,
  SettingsPicker,
  SettingsSection,
  ValueText,
} from '@/components/settings-rows';
import { useSession } from '@/api/session';
import { t } from '@lingui/core/macro';
import { ledgerBalance } from '@/lib/cash';
import { serverHost, useChangeServer } from '@/lib/change-server';
import { describeError } from '@/lib/errors';
import { useFormatters } from '@/lib/format';
import { clearOutbox, usePendingCount } from '@/lib/outbox';
import { setAppearance, useDisplayPrefs, type AppearancePref } from '@/lib/prefs';
import { usePushAlertStore } from '@/lib/push-alerts';
import { clearPersistedQueryCache } from '@/storage/mmkv';
import { pnlColor, usePnlPalette } from '@/styles/pnl';
import { useCSSVariable } from 'uniwind';

/**
 * The settings hub — one screen, no scrolling. Built entirely on the shared
 * settings vocabulary (SettingsForm/SettingsSection/NavRow/…), so the same
 * tree draws identically on both platforms.
 *
 * Settings are folded one row per topic (Trading & journal, Integrations,
 * General); flat, they ran ~16 rows over four group headers. Two things stay
 * expanded on purpose:
 *
 * - **Accounts** is data, not settings — live equity and P&L per account.
 *   Folding it would hide the most useful thing on the screen to save a row.
 * - **Theme** is the most-reached control here and it changes the screen you
 *   are looking at, so it is inline rather than two pushes deep.
 *
 * The extra tap folding costs is bought back by search (the header magnifier),
 * which indexes every setting — including ones no page shows directly, like
 * Import trades — and jumps straight to it.
 */
export default function SettingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApiRequest();
  // Live P&L hues for the account rows' figures (see styles/pnl.ts).
  const palette = usePnlPalette();
  const [foreground] = useCSSVariable(['--color-foreground']) as [string];
  const { session, signOut } = useSession();
  const changeServer = useChangeServer();
  // Offline writes still waiting to sync — signing out would discard them.
  const pendingSyncs = usePendingCount();
  const accountsQuery = useAccounts();
  const accounts = accountsQuery.data;
  const me = useMe();
  // Account rows show live equity, so they need the whole ledger and every
  // account's trades — unscoped on purpose (the global account filter would
  // blank out the rows you aren't currently scoped to).
  const cash = useCash();
  const trades = useTrades();
  const displayPrefs = useDisplayPrefs();
  // Formatters bound to those prefs — a privacy flip re-formats the rows
  // (see lib/format.ts).
  const { formatCurrency, formatPnl } = useFormatters();

  const pnlByAccount = useMemo(() => {
    const totals = new Map<string, number>();
    for (const trade of trades.data ?? []) {
      totals.set(trade.account_id, (totals.get(trade.account_id) ?? 0) + (trade.net_pnl ?? 0));
    }
    return totals;
  }, [trades.data]);

  const tradeCountByAccount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const trade of trades.data ?? []) {
      counts.set(trade.account_id, (counts.get(trade.account_id) ?? 0) + 1);
    }
    return counts;
  }, [trades.data]);

  // The hub stays navigable whatever the server does — Sign out and every
  // sub-screen are reached from here — so a failure is named in the row it
  // affects rather than replacing the page, and only when the persisted cache
  // has nothing to put there instead.
  const accountsFailure =
    accountsQuery.isError && accounts == null ? describeError(accountsQuery.error) : null;

  // Only the search index needs it — the goal itself lives on Trading & journal.
  const year = new Date().getFullYear();

  const [query, setQuery] = useState('');
  // Same search pattern as Trades: a header magnifier toggles the floating
  // bottom Liquid Glass bar. No UISearchController — every native placement
  // was tried and rejected (see settings-search history in the layout).
  const [searching, setSearching] = useState(false);

  // Best-effort: this device's alert channel should die with the session, so
  // a signed-out phone stops getting the next user's journal alerts.
  async function unregisterPush() {
    const token = usePushAlertStore.getState().token;
    if (!token) return;
    try {
      await api('/me/push-tokens', { method: 'DELETE', body: { token } });
    } catch {
      // Signing out matters more than a dead channel row on the server.
    }
    usePushAlertStore.setState({ token: null });
  }

  function handleSignOut() {
    // Always confirmed — signing out drops the cached journal and costs a
    // server URL plus credentials to undo, so it is never a one-tap action.
    // Unsynced offline writes go with it, so their loss is named up front.
    const queuedWarning =
      pendingSyncs === 0
        ? ''
        : pendingSyncs === 1
          ? ' ' + t`1 offline change hasn't synced yet and will be discarded.`
          : ' ' + t`${pendingSyncs} offline changes haven't synced yet and will be discarded.`;
    Alert.alert(
      t`Sign out?`,
      t`You will need to sign in again to reach this server.` + queuedWarning,
      [
        { text: t`Cancel`, style: 'cancel' },
        {
          text: t`Sign out`,
          style: 'destructive',
          // Tokens only — the server URL survives, so signing back in doesn't
          // mean retyping the host. That's why this is "Sign out", not
          // "Disconnect".
          // The push channel belongs to this account too — drop it before the
          // token goes, or the server keeps notifying a signed-out device.
          onPress: () =>
            void unregisterPush().then(() =>
              signOut().then(() => {
                // The query cache persists to MMKV — wipe both the live cache
                // and the snapshot so the next account never sees this one's
                // data. Same for the offline write queue: it belongs to this
                // account.
                queryClient.clear();
                clearPersistedQueryCache();
                clearOutbox();
                router.replace('/login');
              }),
            ),
        },
      ],
    );
  }

  // Flat index behind the search field. `terms` carries the words a setting is
  // hunted by but doesn't say — "backup" for Data & backup's export screens,
  // "dark mode" for Display — so typing what you mean finds the row.
  const searchEntries: {
    icon: SFSymbol;
    label: string;
    terms: string;
    onPress: () => void;
  }[] = [
    {
      icon: 'person.crop.circle',
      label: t`Your account`,
      terms: t`profile email password sign in owner admin security`,
      onPress: () => router.push('/profile'),
    },
    {
      // Searchable in its own right now that the hub states it — #215 folded
      // these terms into "Your account" because no row carried them.
      icon: 'externaldrive.badge.wifi',
      label: t`Server`,
      terms: t`change server url instance host address self-hosted connect`,
      onPress: changeServer,
    },
    {
      icon: 'lock.rotation',
      label: t`Change password`,
      terms: t`security credentials reset`,
      onPress: () => router.push('/change-password'),
    },
    {
      icon: 'person.2',
      label: t`Users`,
      terms: t`accounts people members owner admin invite add remove password reset`,
      onPress: () => router.push('/users'),
    },
    {
      icon: 'banknote',
      label: t`Deposits & withdrawals`,
      terms: t`cash funding ledger balance transfer`,
      onPress: () => router.push('/funding'),
    },
    {
      icon: 'plus.circle.fill',
      label: t`Add account`,
      terms: t`broker new account`,
      onPress: () => router.push('/account-form'),
    },
    {
      icon: 'target',
      label: t`${year} P&L goal`,
      terms: t`annual target profit`,
      onPress: () => router.push('/trading-journal'),
    },
    {
      icon: 'shield',
      label: t`Risk rules`,
      terms: t`limits daily loss compliance position size`,
      onPress: () => router.push('/risk-rules'),
    },
    {
      icon: 'bell.badge',
      label: t`Alerts`,
      terms: t`push notifications webhook loss streak drawdown`,
      onPress: () => router.push('/alerts'),
    },
    {
      icon: 'tag',
      label: t`Tags`,
      terms: t`labels mistakes setups journal`,
      onPress: () => router.push('/tags'),
    },
    {
      icon: 'photo.on.rectangle',
      label: t`Screenshots per trade`,
      terms: t`images cap limit attachments charts`,
      onPress: () => router.push('/trading-journal'),
    },
    {
      icon: 'sparkles',
      label: t`AI — vision scan & coach`,
      terms: t`openai model screenshot scan coach key`,
      onPress: () => router.push('/ai'),
    },
    {
      icon: 'key',
      label: t`API tokens`,
      terms: t`access token integration webhook`,
      onPress: () => router.push('/api-tokens'),
    },
    {
      icon: 'circle.lefthalf.filled',
      label: t`Theme`,
      terms: t`appearance dark light mode system`,
      // Already on this screen — the General section holds it inline.
      onPress: () => setQuery(''),
    },
    {
      icon: 'slider.horizontal.3',
      label: t`Display`,
      terms: t`privacy hide amounts market timezone clock currency formatting`,
      onPress: () => router.push('/display'),
    },
    {
      icon: 'globe',
      label: t`Language`,
      terms: t`locale translation region`,
      onPress: () => void Linking.openSettings(),
    },
    {
      icon: 'externaldrive',
      label: t`Data & backup`,
      terms: t`import export backup restore csv json zip`,
      onPress: () => router.push('/data-backup'),
    },
    {
      icon: 'square.and.arrow.down',
      label: t`Import trades`,
      terms: t`broker fills csv json backup restore`,
      onPress: () => router.push('/import-trades'),
    },
    {
      icon: 'square.and.arrow.up',
      label: t`Export data`,
      terms: t`download backup csv json zip share`,
      onPress: () => router.push('/export-trades'),
    },
    {
      icon: 'info.circle',
      label: t`About TraderMemos`,
      terms: t`version build server licence`,
      onPress: () => router.push('/about'),
    },
  ];

  const needle = query.trim().toLowerCase();
  const matches =
    needle === ''
      ? []
      : searchEntries.filter((entry) =>
          `${entry.label} ${entry.terms}`.toLowerCase().includes(needle),
        );

  return (
    <>
      {/* Trades-style search: the header magnifier (✕ while open) toggles the
          floating bottom Liquid Glass bar. UISearchController placements were
          all tried and rejected on sight — always-visible `stacked`,
          `integrated` (field strands beside the Dynamic Island), and the
          `role="search"` tab (renders as a plain fifth tab on iOS 27,
          expo/expo#47119) — so search here shares the app's own component
          instead. */}
      <Stack.Screen
        options={{
          // Right edge, same corner as every other screen's search toggle.
          headerRight: () => (
            <SearchToggle
              open={searching}
              active={query.trim().length > 0}
              label={t`Search settings`}
              onPress={() => {
                if (searching) setQuery('');
                setSearching((open) => !open);
              }}
            />
          ),
        }}
      />
      {needle !== '' ? (
        <SettingsForm>
          <SettingsSection title={t`Results`}>
            {matches.map((entry) => (
              <NavRow
                key={entry.label}
                systemImage={entry.icon}
                label={entry.label}
                onPress={entry.onPress}
              />
            ))}
            {matches.length === 0 ? (
              <ValueText>{t`No settings match “${query.trim()}”.`}</ValueText>
            ) : null}
          </SettingsSection>
        </SettingsForm>
      ) : (
        <SettingsForm>
          {/* Who is signed in and where from — the two facts that qualify
              every number below. Nothing showed either before /me existed.
              The server row is stated rather than tucked behind Profile: this
              app is a client for a machine the user runs, and which one it is
              talking to is not a detail to hide. */}
          <SettingsSection
            footer={t`Every screen in the app is served by this instance. Tap Server to point the app at a different one — that signs you out.`}
          >
            <NavRow
              systemImage="person.crop.circle"
              label={me.data?.email ?? t`Your account`}
              value={me.data?.is_admin ? t`Owner` : undefined}
              onPress={() => router.push('/profile')}
            />
            {/* No chevron — it opens a prompt, not a push (NavRow doc). It
                lives on the hub because the hub stays navigable when the
                server is unreachable, which is exactly when this is needed;
                Profile is a full-screen error state by then. */}
            <NavRow
              systemImage="externaldrive.badge.wifi"
              label={t`Server`}
              value={serverHost(session?.serverUrl ?? '')}
              accessory="none"
              onPress={changeServer}
            />
          </SettingsSection>

          <SettingsSection title={t`Accounts`}>
            {(accounts ?? []).map((account) => {
              // Equity is the funded base (cash ledger) plus realized P&L, the
              // same figure the account form and web's AccountRow show.
              // `starting_balance` is metadata — it's seeded as the ledger's
              // first deposit, so showing it here would go stale on the first
              // deposit, withdrawal or trade.
              const deposited = ledgerBalance(account.id, cash.data ?? []);
              const netPnl = pnlByAccount.get(account.id) ?? 0;
              const tradeCount = tradeCountByAccount.get(account.id) ?? 0;
              const meta = [
                account.broker || null,
                account.account_type && account.account_type !== 'cash'
                  ? account.account_type.toUpperCase()
                  : null,
                account.base_currency,
                tradeCount > 0 ? t`${tradeCount} trades` : null,
              ]
                .filter(Boolean)
                .join(' · ');
              return (
                <AccountRow
                  key={account.id}
                  name={account.name}
                  meta={meta}
                  equity={formatCurrency(deposited + netPnl, account.base_currency)}
                  pnl={formatPnl(netPnl, account.base_currency)}
                  pnlColor={pnlColor(palette, netPnl)}
                  onPress={() =>
                    router.push({ pathname: '/account-form', params: { id: account.id } })
                  }
                />
              );
            })}
            {accountsFailure ? (
              <ValueText>{accountsFailure.title}</ValueText>
            ) : accounts?.length === 0 ? (
              <ValueText color={foreground}>{t`No accounts yet`}</ValueText>
            ) : null}
            <SettingsButton
              systemImage="plus.circle.fill"
              label={t`Add account`}
              onPress={() => router.push('/account-form')}
            />
            <NavRow
              systemImage="banknote"
              label={t`Deposits & withdrawals`}
              onPress={() => router.push('/funding')}
            />
          </SettingsSection>

          {/* One row per topic. Accounts above stays expanded because it is
              live data — equity and P&L per account — not settings; folding it
              would hide the most useful thing on the screen to save a row.
              Theme stays inline for the same reason it was hoisted out of
              Display: it is the most-reached control here and it changes the
              screen you are looking at. */}
          <SettingsSection footer={t`Search finds any setting directly, without opening its page.`}>
            <SettingsPicker
              label={t`Theme`}
              selectedValue={displayPrefs.appearance}
              onValueChange={(value: AppearancePref) => setAppearance(value)}
              items={[
                { value: 'system', label: t`System` },
                { value: 'light', label: t`Light` },
                { value: 'dark', label: t`Dark` },
              ]}
            />
            <NavRow
              systemImage="chart.line.uptrend.xyaxis"
              label={t`Trading & journal`}
              onPress={() => router.push('/trading-journal')}
            />
            <NavRow
              systemImage="sparkles"
              label={t`Integrations`}
              onPress={() => router.push('/integrations')}
            />
            <NavRow
              systemImage="gearshape"
              label={t`General`}
              onPress={() => router.push('/general')}
            />
          </SettingsSection>

          {/* Last row on the page, directly above Sign out — the iOS place for
              an About entry, and it keeps the destructive action isolated. */}
          <SettingsSection>
            <NavRow
              systemImage="info.circle"
              label={t`About TraderMemos`}
              onPress={() => router.push('/about')}
            />
          </SettingsSection>

          {/* Standalone action, not a row: a filled button inside a section
              card would fill the card edge to edge and read as a red panel. */}
          <CenteredButton role="destructive" label={t`Sign out`} onPress={handleSignOut} />
        </SettingsForm>
      )}
      <FloatingSearchBar
        open={searching}
        value={query}
        placeholder={t`Search settings`}
        onChangeText={setQuery}
        onClose={() => {
          setQuery('');
          setSearching(false);
        }}
      />
    </>
  );
}
