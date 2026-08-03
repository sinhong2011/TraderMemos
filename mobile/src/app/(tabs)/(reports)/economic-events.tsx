import { ContentUnavailableView, Host } from '@expo/ui/swift-ui';
import { SymbolView } from 'expo-symbols';
import { Stack } from 'expo-router/stack';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { useEconomicEvents } from '@/api/hooks';
import { ApiError } from '@/api/client';
import type { EconomicEvent } from '@/api/types';
import { ChipGroup } from '@/components/chips';
import { Pill, type PillTone } from '@/components/pill';
import { Skeleton } from '@/components/skeleton';
import { t } from '@lingui/core/macro';
import { locale } from '@/i18n';
import { addDaysKey, dayKeyInTz, formatWeekLabel, weekStartKey } from '@/lib/events';
import { formatTime } from '@/lib/format';
import { resolveDisplayTimezone, useDisplayPrefs } from '@/lib/prefs';

const MAX_WEEK_OFFSET = 104;

const IMPACT_TONES: Record<string, PillTone> = {
  high: 'neg',
  medium: 'amber',
  low: 'muted',
  holiday: 'accent',
};

function impactLabel(impact: string): string {
  switch (impact) {
    case 'high':
      return t`High`;
    case 'medium':
      return t`Medium`;
    case 'low':
      return t`Low`;
    case 'holiday':
      return t`Holiday`;
    default:
      return impact;
  }
}

function formatDayHeader(dayKey: string): string {
  return new Date(`${dayKey}T12:00:00Z`).toLocaleDateString(locale, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** Week timeline of macro events — impact and currency filters are client-side. */
export default function EconomicEventsScreen() {
  const { theme } = useUnistyles();
  const { timezone } = useDisplayPrefs();
  const tz = resolveDisplayTimezone(timezone);

  const [weekOffset, setWeekOffset] = useState(0);
  const [impacts, setImpacts] = useState<string[]>([]);
  const [currencies, setCurrencies] = useState<string[]>([]);

  const todayKey = dayKeyInTz(new Date().toISOString(), tz);
  const weekStart = weekStartKey(weekOffset, tz);
  // Pad a day each side so UTC-boundary events stay inside the local week.
  const events = useEconomicEvents(addDaysKey(weekStart, -1), addDaysKey(weekStart, 8));

  // No manual useMemo here — the React Compiler memoizes, and derived inputs
  // like weekStart/tz trip its preserve-manual-memoization check.
  const list = events.data ?? [];

  // Currency chips come from what this week actually has.
  const currencyCounts = new Map<string, number>();
  for (const event of list) {
    const key = event.country.toUpperCase();
    currencyCounts.set(key, (currencyCounts.get(key) ?? 0) + 1);
  }
  const weekCurrencies = [...currencyCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([code]) => code);

  const weekEnd = addDaysKey(weekStart, 7);
  const dayMap = new Map<string, EconomicEvent[]>();
  for (const event of list) {
    if (impacts.length > 0 && !impacts.includes(event.impact)) continue;
    if (currencies.length > 0 && !currencies.includes(event.country.toUpperCase())) continue;
    const day = dayKeyInTz(event.time, tz);
    if (day < weekStart || day >= weekEnd) continue;
    const dayList = dayMap.get(day);
    if (dayList) dayList.push(event);
    else dayMap.set(day, [event]);
  }
  const byDay = [...dayMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  const unconfigured = events.error instanceof ApiError && events.error.status === 503;
  const label = formatWeekLabel(weekStart, locale, todayKey);

  const toggle = (values: string[], setValues: (next: string[]) => void) => (value: string) =>
    setValues(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);

  return (
    <>
      <Stack.Screen options={{ title: t`Economic calendar`, headerLargeTitle: false }} />
      <ScrollView
        style={styles.page}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={events.isRefetching}
            onRefresh={() => void events.refetch()}
          />
        }
      >
        {/* Week stepper — tapping the label jumps back to this week. */}
        <View style={styles.stepper}>
          <Pressable
            onPress={() => setWeekOffset((w) => Math.max(-MAX_WEEK_OFFSET, w - 1))}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t`Previous week`}
            style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
          >
            <SymbolView name="chevron.left" size={15} tintColor={theme.colors.foreground} />
          </Pressable>
          <Pressable
            onPress={() => setWeekOffset(0)}
            disabled={weekOffset === 0}
            accessibilityRole="button"
            accessibilityLabel={t`Back to this week`}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Text style={styles.weekLabel}>{label}</Text>
            {weekOffset !== 0 ? <Text style={styles.backToday}>{t`Back to this week`}</Text> : null}
          </Pressable>
          <Pressable
            onPress={() => setWeekOffset((w) => Math.min(MAX_WEEK_OFFSET, w + 1))}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t`Next week`}
            style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
          >
            <SymbolView name="chevron.right" size={15} tintColor={theme.colors.foreground} />
          </Pressable>
        </View>

        <ChipGroup
          options={['high', 'medium', 'low', 'holiday'].map((impact) => ({
            value: impact,
            label: impactLabel(impact),
          }))}
          selected={impacts}
          onToggle={toggle(impacts, setImpacts)}
        />
        {weekCurrencies.length > 1 ? (
          <ChipGroup
            options={weekCurrencies.slice(0, 12).map((code) => ({ value: code, label: code }))}
            selected={currencies}
            onToggle={toggle(currencies, setCurrencies)}
          />
        ) : null}

        {events.isLoading ? (
          <View style={styles.skeletons}>
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} style={styles.skeletonRow} />
            ))}
          </View>
        ) : unconfigured ? (
          <Host style={styles.emptyHost}>
            <ContentUnavailableView
              title={t`Calendar not configured`}
              systemImage="newspaper"
              description={t`The server has no economic-calendar provider configured.`}
            />
          </Host>
        ) : events.error ? (
          <Text style={styles.muted} selectable>
            {events.error.message}
          </Text>
        ) : byDay.length === 0 ? (
          <Host style={styles.emptyHost}>
            <ContentUnavailableView
              title={t`No events`}
              systemImage="newspaper"
              description={
                impacts.length > 0 || currencies.length > 0
                  ? t`Nothing matches the filters this week.`
                  : t`A quiet week.`
              }
            />
          </Host>
        ) : (
          byDay.map(([day, dayEvents]) => {
            const isToday = day === todayKey;
            return (
              <View key={day} style={styles.daySection}>
                <View style={styles.dayHeader}>
                  <Text style={styles.dayTitle}>{formatDayHeader(day)}</Text>
                  {isToday ? <Pill tone="accent">{t`Today`}</Pill> : null}
                </View>
                {dayEvents.map((event) => {
                  const past = new Date(event.time).getTime() < Date.now();
                  const hasActual = event.actual !== '';
                  return (
                    <View key={event.id} style={[styles.eventRow, past && styles.eventPast]}>
                      <Text style={styles.eventTime}>{formatTime(event.time)}</Text>
                      <View style={styles.eventBody}>
                        <View style={styles.eventHead}>
                          <Text style={styles.eventCurrency}>{event.country.toUpperCase()}</Text>
                          <Pill tone={IMPACT_TONES[event.impact] ?? 'muted'}>
                            {impactLabel(event.impact)}
                          </Pill>
                        </View>
                        <Text style={styles.eventTitle}>{event.title}</Text>
                        {hasActual || event.forecast || event.previous ? (
                          <Text style={styles.eventNumbers}>
                            {hasActual ? t`Actual ${event.actual}` : null}
                            {hasActual && event.forecast ? ' · ' : null}
                            {event.forecast ? t`Forecast ${event.forecast}` : null}
                            {(hasActual || event.forecast) && event.previous ? ' · ' : null}
                            {event.previous ? t`Prev ${event.previous}` : null}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
  page: { backgroundColor: theme.colors.background },
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.xl * 2,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  stepButton: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.muted,
  },
  pressed: { opacity: 0.6 },
  weekLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.foreground,
    textAlign: 'center',
    ...theme.numeric,
  },
  backToday: { fontSize: 11, color: theme.colors.mutedForeground, textAlign: 'center' },
  daySection: { gap: theme.spacing.sm, paddingTop: theme.spacing.sm },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  dayTitle: { fontSize: 15, fontWeight: '600', color: theme.colors.foreground },
  eventRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    padding: theme.spacing.md,
  },
  eventPast: { opacity: 0.55 },
  eventTime: {
    width: 64,
    fontSize: 13,
    color: theme.colors.mutedForeground,
    ...theme.numeric,
  },
  eventBody: { flex: 1, gap: 2 },
  eventHead: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  eventCurrency: { fontSize: 12, fontWeight: '600', color: theme.colors.mutedForeground },
  eventTitle: { fontSize: 14, fontWeight: '500', color: theme.colors.foreground },
  eventNumbers: { fontSize: 12, color: theme.colors.mutedForeground, ...theme.numeric },
  skeletons: { gap: theme.spacing.sm },
  skeletonRow: { height: 72, borderRadius: theme.radius.lg },
  emptyHost: { minHeight: 280 },
  muted: {
    color: theme.colors.mutedForeground,
    textAlign: 'center',
    paddingVertical: theme.spacing.xl,
  },
}));
