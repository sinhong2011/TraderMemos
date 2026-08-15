import { useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useState } from 'react';
import { Chip, cn } from 'panelui-native';
import { ScrollView, Text, View } from 'react-native';

import type { BarInterval } from '@/api/types';
import { Card, ControlRow, DateRow, SectionFooter, SectionHeader } from '@/components/form-rows';
import { GlassButton } from '@/components/glass-button';
import { FloatingSearchBar, SearchToggle } from '@/components/search-bar';
import { Segmented } from '@/components/segmented';
import { t } from '@lingui/core/macro';
import { BAR_INTERVALS } from '@/lib/trade-bars';
import { storage } from '@/storage/mmkv';

type Market = 'stock' | 'crypto' | 'forex' | 'future';

/** Its own list, not the advanced chart's — what you backtest is rarely what you watch. */
const RECENTS_KEY = 'backtest:recent-symbols';
const MAX_RECENTS = 6;
const DAY_MS = 86_400_000;
/** Enough tape to have a session worth trading without waiting on a huge fetch. */
const DEFAULT_WINDOW_DAYS = 30;

function loadRecents(): string[] {
  try {
    const raw = storage.getString(RECENTS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** The `to` bound is inclusive of the day you picked — bars run to its close. */
function endOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(23, 59, 59, 0);
  return d.getTime();
}

/**
 * Paper-trading setup — pick a symbol, a window and a resolution, then replay
 * that tape bar by bar with the future hidden and place orders as it runs.
 *
 * Deliberately the whole of the configuration: the replay itself has no
 * settings, because every control it could offer (jump forward, change
 * interval mid-run, re-fit the scale) is a way to see the next bar early.
 */
export default function BacktestScreen() {
  const router = useRouter();
  const [symbol, setSymbol] = useState(() => loadRecents()[0] ?? '');
  const [pendingSymbol, setPendingSymbol] = useState('');
  const [searching, setSearching] = useState(false);
  const [recents, setRecents] = useState<string[]>(loadRecents);
  const [market, setMarket] = useState<Market>('stock');
  const [interval, setBarInterval] = useState<BarInterval>('60');
  const [from, setFrom] = useState(
    () => new Date(startOfDay(Date.now() - DEFAULT_WINDOW_DAYS * DAY_MS)),
  );
  const [to, setTo] = useState(() => new Date(endOfDay(Date.now())));

  function commitSymbol(raw: string) {
    const next = raw.trim().toUpperCase();
    if (!next) return;
    setSymbol(next);
    const nextRecents = [next, ...recents.filter((s) => s !== next)].slice(0, MAX_RECENTS);
    setRecents(nextRecents);
    storage.set(RECENTS_KEY, JSON.stringify(nextRecents));
  }

  const fromMs = startOfDay(from.getTime());
  const toMs = endOfDay(to.getTime());
  const rangeValid = fromMs < toMs;
  const ready = symbol.trim().length > 0 && rangeValid;

  const markets = [
    { value: 'stock' as const, label: t`Stock` },
    { value: 'crypto' as const, label: t`Crypto` },
    { value: 'forex' as const, label: t`Forex` },
    { value: 'future' as const, label: t`Futures` },
  ];

  function start() {
    if (!ready) return;
    // Re-committing keeps a symbol you typed and never tapped in the recents.
    commitSymbol(symbol);
    router.push({
      pathname: '/replay',
      params: {
        mode: 'backtest',
        symbol: symbol.trim().toUpperCase(),
        market,
        interval,
        from: String(fromMs),
        to: String(toMs),
      },
    });
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <SearchToggle
              open={searching}
              active={false}
              label={t`Search symbol`}
              onPress={() => {
                if (searching) setPendingSymbol('');
                setSearching((open) => !open);
              }}
            />
          ),
        }}
      />
      <ScrollView
        className="bg-background"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-3 p-4 pb-18"
        keyboardDismissMode="on-drag"
      >
        <SectionHeader label={t`Symbol`} />
        <Card>
          <ControlRow label={t`Symbol`}>
            <Text
              className={cn(
                'text-base font-semibold text-foreground tabular-nums',
                symbol === '' && 'font-normal text-muted-foreground',
              )}
            >
              {symbol === '' ? t`Search a ticker` : symbol}
            </Text>
          </ControlRow>
          <ControlRow label={t`Market`}>
            <Segmented options={markets} value={market} onChange={setMarket} />
          </ControlRow>
        </Card>
        {recents.length > 0 ? (
          <View className="flex-row flex-wrap gap-2">
            {recents.map((recent) => (
              <Chip
                key={recent}
                variant="outline"
                size="sm"
                selected={recent === symbol}
                onPress={() => commitSymbol(recent)}
              >
                {recent}
              </Chip>
            ))}
          </View>
        ) : null}

        <SectionHeader label={t`Replay window`} />
        <Card>
          <DateRow
            label={t`Start date`}
            selection={from}
            displayedComponents={['date']}
            onDateChange={setFrom}
          />
          <DateRow
            label={t`End date`}
            selection={to}
            displayedComponents={['date']}
            onDateChange={setTo}
          />
          <ControlRow label={t`Interval`}>
            <Segmented
              variant="menu"
              flush
              options={BAR_INTERVALS}
              value={interval}
              onChange={setBarInterval}
            />
          </ControlRow>
        </Card>
        <SectionFooter
          label={
            rangeValid
              ? t`The replay starts a few bars in for context, then reveals one bar at a time. Orders fill at the bar's close.`
              : t`The end of the window has to fall after its start.`
          }
        />

        <View className="mt-3">
          <GlassButton
            fill
            prominent
            label={t`Start replay`}
            systemImage="play.fill"
            disabled={!ready}
            onPress={start}
          />
        </View>
      </ScrollView>
      <FloatingSearchBar
        open={searching}
        value={pendingSymbol}
        placeholder={t`Symbol, e.g. SPY`}
        autoCapitalize="characters"
        onChangeText={setPendingSymbol}
        onSubmit={() => {
          commitSymbol(pendingSymbol);
          setPendingSymbol('');
          setSearching(false);
        }}
        onClose={() => {
          setPendingSymbol('');
          setSearching(false);
        }}
      />
    </>
  );
}
