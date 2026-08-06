import {
  Button,
  HStack,
  Image,
  Picker,
  Section,
  Spacer,
  Text as UIText,
  VStack,
} from '@expo/ui/swift-ui';
import { font, foregroundStyle, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Linking } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import type { SFSymbol } from 'sf-symbols-typescript';

import { useAccounts, useCash, useMe, useTrades } from '@/api/hooks';
import { CenteredButton } from '@/components/centered-button';
import { NavRow } from '@/components/nav-row';
import { SettingsForm } from '@/components/settings-form';
import { useSession } from '@/api/session';
import { t } from '@lingui/core/macro';
import { ledgerBalance } from '@/lib/cash';
import { formatCurrency, formatPnl } from '@/lib/format';
import { setAppearance, useDisplayPrefs, type AppearancePref } from '@/lib/prefs';
import { clearPersistedQueryCache } from '@/storage/mmkv';
import { AppHost } from '@/components/app-host';

/**
 * Native SwiftUI settings hub — one screen, no scrolling.
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
 * The extra tap folding costs is bought back by the search field, which
 * indexes every setting — including ones no page shows directly, like Import
 * trades — and jumps straight to it.
 */
export default function SettingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { theme } = useUnistyles();
  const { signOut } = useSession();
  const { data: accounts } = useAccounts();
  const me = useMe();
  // Account rows show live equity, so they need the whole ledger and every
  // account's trades — unscoped on purpose (the global account filter would
  // blank out the rows you aren't currently scoped to).
  const cash = useCash();
  const trades = useTrades();
  // Money formatters read privacy mode at call time; subscribe so a flip
  // re-renders the rows.
  const displayPrefs = useDisplayPrefs();

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

  // Only the search index needs it — the goal itself lives on Trading & journal.
  const year = new Date().getFullYear();

  const [query, setQuery] = useState('');
  function handleSignOut() {
    // Always confirmed — signing out drops the cached journal and costs a
    // server URL plus credentials to undo, so it is never a one-tap action.
    Alert.alert(t`Sign out?`, t`You will need to sign in again to reach this server.`, [
      { text: t`Cancel`, style: 'cancel' },
      {
        text: t`Sign out`,
        style: 'destructive',
        // Tokens only — the server URL survives, so signing back in doesn't
        // mean retyping the host. That's why this is "Sign out", not
        // "Disconnect".
        onPress: () =>
          void signOut().then(() => {
            // The query cache persists to MMKV — wipe both the live cache and
            // the snapshot so the next account never sees this one's data.
            queryClient.clear();
            clearPersistedQueryCache();
            router.replace('/login');
          }),
      },
    ]);
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
      {/* `stacked` — the search field sits under the large title, the standard
          iOS list-search look. The bottom-floating field iOS 26 Settings uses
          is a *toolbar-integrated* search bar: UIKit only moves it down when
          the screen owns a UIToolbar, and react-native-screens exposes no way
          to add one (these tabs are a UITabBar). With `integrated` the field
          just strands itself in the navigation bar. */}
      <Stack.Screen
        options={{
          headerSearchBarOptions: {
            placement: 'stacked',
            placeholder: t`Search`,
            autoCapitalize: 'none',
            hideWhenScrolling: false,
            textColor: theme.colors.foreground,
            onChangeText: (event) => setQuery(event.nativeEvent.text),
            onCancelButtonPress: () => setQuery(''),
          },
        }}
      />
      <AppHost style={{ flex: 1, backgroundColor: theme.colors.background }}>
        {needle !== '' ? (
          <SettingsForm>
            <Section title={t`Results`}>
              {matches.map((entry) => (
                <NavRow
                  key={entry.label}
                  systemImage={entry.icon}
                  label={entry.label}
                  onPress={entry.onPress}
                />
              ))}
              {matches.length === 0 ? (
                <UIText
                  modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}
                >
                  {t`No settings match “${query.trim()}”.`}
                </UIText>
              ) : null}
            </Section>
          </SettingsForm>
        ) : (
          <SettingsForm>
          {/* Who is signed in, which nothing showed before /me existed. First
              on the page: it identifies everything below it. */}
          <Section>
            <NavRow
              systemImage="person.crop.circle"
              label={me.data?.email ?? t`Your account`}
              value={me.data?.is_admin ? t`Owner` : undefined}
              onPress={() => router.push('/profile')}
            />
          </Section>

          <Section title={t`Accounts`}>
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
                <Button
                  key={account.id}
                  onPress={() =>
                    router.push({ pathname: '/account-form', params: { id: account.id } })
                  }
                >
                  <HStack spacing={8}>
                    <VStack alignment="leading" spacing={2}>
                      <UIText
                        modifiers={[foregroundStyle({ type: 'hierarchical', style: 'primary' })]}
                      >
                        {account.name}
                      </UIText>
                      {/* Single string child — the SwiftUI Text bridge can't mount an
                          array of interpolations (RawText crash). */}
                      <UIText
                        modifiers={[
                          font({ size: 13 }),
                          foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                        ]}
                      >
                        {meta}
                      </UIText>
                    </VStack>
                    <Spacer />
                    <VStack alignment="trailing" spacing={2}>
                      <UIText
                        modifiers={[foregroundStyle({ type: 'hierarchical', style: 'primary' })]}
                      >
                        {formatCurrency(deposited + netPnl, account.base_currency)}
                      </UIText>
                      <UIText
                        modifiers={[
                          font({ size: 13 }),
                          foregroundStyle(
                            netPnl > 0
                              ? theme.colors.profit
                              : netPnl < 0
                                ? theme.colors.loss
                                : theme.colors.mutedForeground,
                          ),
                        ]}
                      >
                        {formatPnl(netPnl, account.base_currency)}
                      </UIText>
                    </VStack>
                    <Image systemName="chevron.right" size={12} color={theme.colors.mutedForeground} />
                  </HStack>
                </Button>
              );
            })}
            {accounts?.length === 0 ? <UIText>{t`No accounts yet`}</UIText> : null}
            <Button
              systemImage="plus.circle.fill"
              label={t`Add account`}
              onPress={() => router.push('/account-form')}
            />
            <NavRow
              systemImage="banknote"
              label={t`Deposits & withdrawals`}
              onPress={() => router.push('/funding')}
            />
          </Section>

          {/* One row per topic. Accounts above stays expanded because it is
              live data — equity and P&L per account — not settings; folding it
              would hide the most useful thing on the screen to save a row.
              Theme stays inline for the same reason it was hoisted out of
              Display: it is the most-reached control here and it changes the
              screen you are looking at. */}
          <Section
            footer={
              <UIText>{t`Search finds any setting directly, without opening its page.`}</UIText>
            }
          >
            <Picker
              label={t`Theme`}
              modifiers={[pickerStyle('menu')]}
              selection={displayPrefs.appearance}
              onSelectionChange={(value) => setAppearance(value as AppearancePref)}
            >
              <UIText key="system" modifiers={[tag('system')]}>
                {t`System`}
              </UIText>
              <UIText key="light" modifiers={[tag('light')]}>
                {t`Light`}
              </UIText>
              <UIText key="dark" modifiers={[tag('dark')]}>
                {t`Dark`}
              </UIText>
            </Picker>
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
          </Section>

          {/* Last row on the page, directly above Sign out — the iOS place for
              an About entry, and it keeps the destructive action isolated. */}
          <Section>
            <NavRow
              systemImage="info.circle"
              label={t`About TraderMemos`}
              onPress={() => router.push('/about')}
            />
          </Section>

          <Section>
            <CenteredButton role="destructive" label={t`Sign out`} onPress={handleSignOut} />
          </Section>
          </SettingsForm>
        )}
      </AppHost>
    </>
  );
}
