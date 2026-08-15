
import { Stack } from 'expo-router/stack';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { useEconomicEvents } from '@/api/hooks';
import { ApiError } from '@/api/client';
import type { EconomicEvent } from '@/api/types';
import { ErrorState } from '@/components/error-state';
import { EventFilterMenu } from '@/components/event-filter-menu';
import { Pill, type PillTone } from '@/components/pill';
import { FloatingSearchBar, SearchToggle } from '@/components/search-bar';
import { Skeleton } from '@/components/skeleton';
import { t } from '@lingui/core/macro';
import { locale } from '@/i18n';
import {
  clearEventFilters,
  toggleEventFilter,
  useEventFilters,
  type EventFilters,
} from '@/lib/event-filters';
import { toggleEventReminder, useEventBookmarks } from '@/lib/event-reminders';
import { addDaysKey, dayKeyInTz, formatWeekLabel, weekStartKey } from '@/lib/events';
import { useFormatters } from '@/lib/format';
import { resolveDisplayTimezone, useDisplayPrefs } from '@/lib/prefs';
import type { AppTheme } from '@/styles/unistyles';
import { AppHost } from '@/components/app-host';

/** Loudest first — the order the strip bar and the filter menu both read in. */
const IMPACTS = ['high', 'medium', 'low', 'holiday'] as const;

const IMPACT_TONES: Record<string, PillTone> = {
  high: 'neg',
  medium: 'amber',
  low: 'muted',
  holiday: 'accent',
};

/** Rail geometry — the dot has to land on the meta line, not float above it. */
const RAIL_WIDTH = 22;
const DOT_SIZE = 7;
const DOT_TOP = 6;

/** Strip bar range, in points, from "one event" to "the week's busiest day". */
const BAR_MIN = 3;
const BAR_MAX = 14;

/** The pager holds the week either side of the one you're on, so a swipe has
 *  somewhere to go and lands on real data rather than a spinner. */
const PAGES = [-1, 0, 1] as const;

/** How close to either end of the timeline loads two more weeks, in points. */
const EDGE_THRESHOLD = 600;
/** Weeks the window will hold. The API caps a range at 366 days, and a year of
 *  rows is far past the point where scrolling is the right way to travel — the
 *  pager and Today cover the rest. */
const MAX_WEEKS = 40;
/** Weeks added at a time when you reach an end. */
const GROW_WEEKS = 2;

/** iOS 26 sheet feel — settles quickly, barely overshoots. */
const SEARCH_SPRING = { damping: 22, stiffness: 240, mass: 0.9, overshootClamping: false };

/**
 * The jump back to this week. Kept mounted and scaled to nothing when you're
 * already there, so it grows and shrinks instead of blinking in and out.
 */
function TodayButton({ visible, onPress }: { visible: boolean; onPress: () => void }) {
  const [progress] = useState(() => new Animated.Value(visible ? 1 : 0));

  useEffect(() => {
    Animated.spring(progress, {
      toValue: visible ? 1 : 0,
      ...SEARCH_SPRING,
      useNativeDriver: true,
    }).start();
  }, [visible, progress]);

  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] });

  return (
    <Animated.View
      style={[styles.todayHolder, { opacity: progress, transform: [{ scale }] }]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <Pressable
        onPress={onPress}
        hitSlop={10}
        accessibilityRole="button"
        style={({ pressed }) => [styles.todayButton, pressed && styles.pressed]}
      >
        <Text style={styles.todayLabel}>{t`Today`}</Text>
      </Pressable>
    </Animated.View>
  );
}

/** The day marker, used both inline in the timeline and floating above it. */
function DayChip({ day, isToday }: { day: string; isToday: boolean }) {
  return (
    <View style={styles.dayChip}>
      <Text style={styles.dayTitle}>{formatDayHeader(day)}</Text>
      {isToday ? (
        <View style={styles.todayTag}>
          <Text style={styles.todayTagLabel}>{t`Today`}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Impact color, shared by the rail dots, the strip bars and the day pills. */
function impactColor(theme: AppTheme, impact: string): string {
  switch (impact) {
    case 'high':
      return theme.colors.loss;
    case 'medium':
      return theme.colors.accent;
    case 'holiday':
      return theme.colors.primary;
    default:
      return theme.colors.mutedForeground;
  }
}

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

/** The feed files cross-market releases (OPEC, G20) under the country "ALL" —
 *  printed raw it reads as a "select everything" control sitting in the list. */
function currencyLabel(code: string): string {
  return code === 'ALL' ? t`Global` : code;
}

function formatDayHeader(dayKey: string): string {
  return new Date(`${dayKey}T12:00:00Z`).toLocaleDateString(locale, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** Single-field format on purpose: Hermes mislabels weekday parts in
 *  `formatToParts`, so anything that picks the weekday out of a multi-field
 *  format comes back wrong (see the shared date helpers). */
function weekdayInitial(dayKey: string): string {
  return new Date(`${dayKey}T12:00:00Z`).toLocaleDateString(locale, {
    weekday: 'narrow',
    timeZone: 'UTC',
  });
}

const SUFFIX_SCALES: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 };

/** Feed figures are display strings ("54.7", "-4.0%", "1.2M") — parse what we
 *  can so actual-vs-forecast earns an arrow, and skip the rest silently. */
function toNumber(value: string): number | null {
  const match = /^(-?\d+(?:\.\d+)?)([KMBT])?%?$/i.exec(value.replace(/[,\s]/g, ''));
  if (!match) return null;
  const suffix = match[2]?.toLowerCase();
  return parseFloat(match[1]) * (suffix ? (SUFFIX_SCALES[suffix] ?? 1) : 1);
}

/** The day's loudest release — what colors its bar on the strip. */
function topImpact(events: readonly EconomicEvent[]): string {
  return IMPACTS.find((impact) => events.some((event) => event.impact === impact)) ?? 'low';
}

/**
 * Labelled figure under an event. Above/below forecast is stated as direction
 * only — whether a beat is good depends on the series (payrolls vs. jobless
 * claims), which the feed doesn't say, so no P&L color goes near it.
 */
function Stat({
  label,
  value,
  strong = false,
  trend = 0,
}: {
  label: string;
  value: string;
  strong?: boolean;
  trend?: number;
}) {
  const { theme } = useUnistyles();
  return (
    <View style={[styles.stat, strong && styles.statStrong]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, strong && styles.statValueStrong]}>{value}</Text>
      {trend !== 0 ? (
        <Icon
          name={trend > 0 ? 'arrow.up' : 'arrow.down'}
          size={9}
          weight="bold"
          tintColor={strong ? theme.colors.primary : theme.colors.mutedForeground}
        />
      ) : null}
    </View>
  );
}

/**
 * One node on the week's timeline: a dot on the rail carrying the impact color,
 * then the release. The clock leads the meta line rather than holding a fixed
 * gutter — titles are what you scan, and they get that width back.
 *
 * `isFirst`/`isLast` are the ends of the *week*, not of the day: the rail runs
 * unbroken from the week's first release to its last, threading behind every
 * day header on the way.
 */
function EventRow({
  event,
  now,
  isFirst,
  isLast,
  bookmarked,
  onBookmark,
  onMeasure,
}: {
  event: EconomicEvent;
  /** Render-time instant, read once by the screen — a per-row `Date.now()` is
   *  an impure render, and the rows would disagree about "past" mid-list. */
  now: number;
  isFirst: boolean;
  isLast: boolean;
  bookmarked: boolean;
  onBookmark: () => void;
  onMeasure: (y: number) => void;
}) {
  const { theme } = useUnistyles();
  // Bound to the display clock (see lib/format.ts).
  const { formatTime } = useFormatters();
  const past = new Date(event.time).getTime() < now;
  const hasActual = event.actual !== '';

  const actual = hasActual ? toNumber(event.actual) : null;
  const forecast = event.forecast ? toNumber(event.forecast) : null;
  const trend = actual != null && forecast != null ? Math.sign(actual - forecast) : 0;

  return (
    <View style={styles.eventRow} onLayout={(e) => onMeasure(e.nativeEvent.layout.y)}>
      <View style={styles.rail}>
        {!isFirst ? <View style={[styles.railLine, styles.railAbove]} /> : null}
        {!isLast ? <View style={[styles.railLine, styles.railBelow]} /> : null}
        <View
          style={[
            styles.dot,
            { backgroundColor: impactColor(theme, event.impact) },
            past && styles.past,
          ]}
        />
      </View>
      <View style={[styles.eventBody, past && styles.past]}>
        <View style={styles.eventMeta}>
          <Text style={styles.eventTime}>{formatTime(event.time)}</Text>
          <Text style={styles.eventCurrency}>{currencyLabel(event.country.toUpperCase())}</Text>
          <Pill tone={IMPACT_TONES[event.impact] ?? 'muted'}>{impactLabel(event.impact)}</Pill>
          <View style={styles.metaSpacer} />
          {/* Past releases can't be reminded about — the bell goes with them. */}
          {!past ? (
            <Pressable
              onPress={onBookmark}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityState={{ selected: bookmarked }}
              accessibilityLabel={bookmarked ? t`Remove reminder` : t`Remind me`}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Icon
                name={bookmarked ? 'bell.fill' : 'bell'}
                size={15}
                tintColor={bookmarked ? theme.colors.primary : theme.colors.mutedForeground}
              />
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.eventTitle}>{event.title}</Text>
        {hasActual || event.forecast || event.previous ? (
          <View style={styles.stats}>
            {hasActual ? <Stat label={t`Actual`} value={event.actual} strong trend={trend} /> : null}
            {event.forecast ? <Stat label={t`Forecast`} value={event.forecast} /> : null}
            {event.previous ? <Stat label={t`Prev`} value={event.previous} /> : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Timeline in outline while a week loads. Shaped like the rows it stands in
 * for — rail, dot, meta line, title — so the list doesn't jump when the real
 * events land, and so a slow week never shows a spinner over an empty screen.
 */
function TimelineSkeleton() {
  return (
    <View>
      {Array.from({ length: 6 }, (_, i) => (
        <View key={i} style={styles.eventRow}>
          <View style={styles.rail}>
            {i > 0 ? <View style={[styles.railLine, styles.railAbove]} /> : null}
            {i < 5 ? <View style={[styles.railLine, styles.railBelow]} /> : null}
            <View style={[styles.dot, styles.dotIdle]} />
          </View>
          <View style={styles.eventBody}>
            <Skeleton style={styles.skeletonMeta} />
            <Skeleton style={[styles.skeletonTitle, i % 3 === 1 && styles.skeletonTitleShort]} />
          </View>
        </View>
      ))}
    </View>
  );
}

type Day = { key: string; count: number; impact: string };

/**
 * One entry in the continuous timeline. Every row carries its week so a scroll
 * can say which week it has reached, and a week with nothing in it still gets a
 * `gap` row — otherwise the scroll could never arrive there to report it.
 */
type Row =
  | { kind: 'day'; day: string; week: string }
  | { kind: 'event'; event: EconomicEvent; week: string }
  | { kind: 'gap'; week: string };

/**
 * One page of the week pager: the range it covers, then a cell per day carrying
 * that day's event count as a bar and its loudest impact as the bar's color, so
 * "Friday is heavy" reads before you scroll. Tapping a day jumps the timeline.
 */
function WeekPage({
  label,
  days,
  todayKey,
  width,
  onSelectDay,
}: {
  /** Month scale only — the strip beside it already carries the dates. */
  label: string;
  days: readonly Day[];
  todayKey: string;
  /** Exactly one page — the pager can't snap without it. */
  width: number;
  onSelectDay: (dayKey: string) => void;
}) {
  const { theme } = useUnistyles();
  const busiest = Math.max(1, ...days.map((day) => day.count));

  return (
    <View style={[styles.page, { width }]}>
      <Text style={styles.weekLabel} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.strip}>
        {days.map((day) => {
          const isToday = day.key === todayKey;
          return (
            <Pressable
              key={day.key}
              onPress={() => onSelectDay(day.key)}
              disabled={day.count === 0}
              accessibilityRole="button"
              accessibilityLabel={`${formatDayHeader(day.key)}, ${day.count}`}
              style={({ pressed }) => [styles.stripCell, pressed && styles.pressed]}
            >
              <Text style={styles.stripWeekday}>{weekdayInitial(day.key)}</Text>
              <View style={[styles.stripDate, isToday && styles.stripDateToday]}>
                <Text style={[styles.stripDay, isToday && styles.stripDayToday]}>
                  {Number(day.key.slice(8, 10))}
                </Text>
              </View>
              <View style={styles.stripTrack}>
                {day.count > 0 ? (
                  <View
                    style={[
                      styles.stripBar,
                      {
                        height: BAR_MIN + Math.round((day.count / busiest) * (BAR_MAX - BAR_MIN)),
                        backgroundColor: impactColor(theme, day.impact),
                      },
                    ]}
                  />
                ) : (
                  <View style={styles.stripEmpty} />
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Week timeline of macro events — impact and currency filters are client-side. */
export default function EconomicEventsScreen() {
  const { timezone } = useDisplayPrefs();
  const tz = resolveDisplayTimezone(timezone);
  // The controls sit outside the scroll view, so they clear the transparent
  // nav bar with padding of their own instead of a content inset.
  const headerHeight = useHeaderHeight();

  const now = new Date();
  const todayKey = dayKeyInTz(now.toISOString(), tz);
  const todayWeek = weekStartKey(0, tz);

  // The timeline is one continuous list; these are the ends of what's loaded,
  // not a week being viewed. Both grow as you reach them.
  const [startWeek, setStartWeek] = useState(() => addDaysKey(todayWeek, -7));
  const [endWeek, setEndWeek] = useState(() => addDaysKey(todayWeek, 7));
  /** Week under the pinned header — what the pager reports, driven by scroll. */
  const [visibleWeek, setVisibleWeek] = useState(todayWeek);
  /** Day at the top of the list, or null while the first one is still in view.
   *  RN's own `stickyHeaderIndices` pins an empty clone of these rows in this
   *  list, so the pinned copy is rendered from the scroll position instead. */
  const [pinnedDay, setPinnedDay] = useState<string | null>(null);

  const [pageWidth, setPageWidth] = useState(0);
  const [pulling, setPulling] = useState(false);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  // Persisted: the trader who only watches high-impact USD shouldn't rebuild
  // that selection every visit.
  const { impacts, currencies } = useEventFilters();
  const bookmarks = useEventBookmarks();

  const scrollRef = useRef<ScrollView>(null);
  const pagerRef = useRef<ScrollView>(null);
  /** Tops of every day header and event row, by key. */
  const offsets = useRef<Record<string, number>>({});
  /** Measured from the first day header so the "now" anchor scrolls clear of
   *  the one that will be pinned above it. */
  const [stickyHeight, setStickyHeight] = useState(40);
  /** Set once the opening scroll-to-now has been honored. */
  const anchored = useRef(false);

  // A day of padding each side so UTC-boundary events stay in the week they
  // belong to.
  const events = useEconomicEvents(addDaysKey(startWeek, -1), addDaysKey(endWeek, 8));

  // No manual useMemo here — the React Compiler memoizes, and derived inputs
  // like weekStart/tz trip its preserve-manual-memoization check.
  const fetched = events.data ?? [];

  const needle = query.trim().toLowerCase();
  const byDayKey = new Map<string, EconomicEvent[]>();
  for (const event of fetched) {
    if (impacts.length > 0 && !impacts.includes(event.impact)) continue;
    if (currencies.length > 0 && !currencies.includes(event.country.toUpperCase())) continue;
    if (
      needle.length > 0 &&
      !event.title.toLowerCase().includes(needle) &&
      !event.country.toLowerCase().includes(needle)
    )
      continue;
    const day = dayKeyInTz(event.time, tz);
    const dayList = byDayKey.get(day);
    if (dayList) dayList.push(event);
    else byDayKey.set(day, [event]);
  }

  const weeks: string[] = [];
  for (let week = startWeek; week <= endWeek; week = addDaysKey(week, 7)) weeks.push(week);

  const weekDays = (start: string): Day[] =>
    // Empty days included — a quiet Wednesday is information, and dropping it
    // would slide the weekdays out from under their dates.
    Array.from({ length: 7 }, (_, i) => {
      const key = addDaysKey(start, i);
      const dayEvents = byDayKey.get(key) ?? [];
      return { key, count: dayEvents.length, impact: topImpact(dayEvents) };
    });

  // One flat list across every loaded week: sticky headers have to be direct
  // children of the ScrollView, and a week with nothing in it still needs a row
  // or the scroll could never reach it to report itself.
  const rows: Row[] = [];
  for (const week of weeks) {
    let weekHasEvents = false;
    for (let i = 0; i < 7; i++) {
      const day = addDaysKey(week, i);
      const dayEvents = byDayKey.get(day);
      if (!dayEvents?.length) continue;
      weekHasEvents = true;
      rows.push({ kind: 'day', day, week });
      for (const event of dayEvents) rows.push({ kind: 'event', event, week });
    }
    if (!weekHasEvents) rows.push({ kind: 'gap', week });
  }

  const firstEvent = rows.findIndex((row) => row.kind === 'event');
  const lastEvent = rows.map((row) => row.kind === 'event').lastIndexOf(true);
  /** Row keys that mark a position, in list order — what a scroll is matched against. */
  const anchors: { key: string; week: string; day: string | null }[] = rows.flatMap((row) =>
    row.kind === 'day'
      ? [{ key: row.day, week: row.week, day: row.day as string | null }]
      : row.kind === 'gap'
        ? [{ key: row.week, week: row.week, day: null }]
        : [],
  );

  // Open on the clock: the first release still to come.
  const eventRows = rows.filter((row) => row.kind === 'event');
  const anchorId =
    (eventRows.find((row) => new Date(row.event.time).getTime() >= now.getTime()) ??
      eventRows.at(-1))?.event.id.toString() ?? null;

  const unconfigured = events.error instanceof ApiError && events.error.status === 503;
  const loading = events.isLoading || (events.isFetching && !pulling && rows.length === 0);

  // Counts describe the week on screen, not everything loaded.
  const visibleWeekEnd = addDaysKey(visibleWeek, 7);
  const inVisibleWeek = (event: EconomicEvent) => {
    const day = dayKeyInTz(event.time, tz);
    return day >= visibleWeek && day < visibleWeekEnd;
  };

  const weekCurrencies = (() => {
    const counts = new Map<string, number>();
    for (const event of fetched.filter(inVisibleWeek)) {
      const key = event.country.toUpperCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([code]) => code);
  })();

  const clearFilters = () => {
    clearEventFilters();
    setQuery('');
  };

  const toggle = (dimension: keyof EventFilters) => (value: string) =>
    toggleEventFilter(dimension, value);

  const pullToRefresh = () => {
    setPulling(true);
    void events.refetch().finally(() => setPulling(false));
  };

  const scrollToKey = (key: string, animated: boolean) => {
    const y = offsets.current[key];
    if (y == null) return false;
    scrollRef.current?.scrollTo({ y: Math.max(0, y), animated });
    return true;
  };

  /** First anchor at or after a week — where that week starts on the timeline. */
  const jumpToWeek = (week: string) => {
    setVisibleWeek(week);
    const anchor = anchors.find((entry) => entry.week === week) ?? null;
    if (anchor) scrollToKey(anchor.key, true);
    else scrollToKey(week, true);
  };

  const remember = (key: string, y: number) => {
    offsets.current[key] = y;
    if (anchored.current || key !== anchorId) return;
    anchored.current = true;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - stickyHeight), animated: false });
  };

  // Scroll drives the header, and reaching either end grows the window. Both
  // are cheap: only day headers are candidates, and only a change commits.
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y + 4;
    let current: { key: string; week: string; day: string | null } | null = null;
    for (const anchor of anchors) {
      const top = offsets.current[anchor.key];
      if (top == null || top > y) break;
      current = anchor;
    }
    const week = current?.week ?? anchors[0]?.week ?? visibleWeek;
    if (week !== visibleWeek) setVisibleWeek(week);
    // Only once its own row has left the top — otherwise the day would be
    // named twice, an inch apart.
    const pinned =
      current?.day && (offsets.current[current.key] ?? 0) + 4 < y ? current.day : null;
    if (pinned !== pinnedDay) setPinnedDay(pinned);

  };

  /**
   * Grow the window a gesture at a time. Checked when a drag or its momentum
   * ends rather than during the scroll: at an edge the test stays true, and two
   * quiet weeks are shorter than a screen, so a live check re-fires against its
   * own new content and runs away by years.
   */
  const onScrollSettled = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (weeks.length >= MAX_WEEKS) return;
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    // A list shorter than its own viewport is at both ends at once; growing off
    // that would never stop.
    if (contentSize.height <= layoutMeasurement.height) return;
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - EDGE_THRESHOLD) {
      setEndWeek((last) => addDaysKey(last, GROW_WEEKS * 7));
    } else if (contentOffset.y <= EDGE_THRESHOLD) {
      setStartWeek((first) => addDaysKey(first, -GROW_WEEKS * 7));
    }
  };

  // A settled page that isn't the middle one is a week jump; the pager then
  // snaps back to the middle so there's always a page either side.
  const onPagerSettled = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (pageWidth === 0) return;
    const delta = Math.round(event.nativeEvent.contentOffset.x / pageWidth) - 1;
    if (delta === 0) return;
    jumpToWeek(addDaysKey(visibleWeek, delta * 7));
    pagerRef.current?.scrollTo({ x: pageWidth, animated: false });
  };

  const bookmark = async (event: EconomicEvent) => {
    const result = await toggleEventReminder(event);
    // Denial is the one outcome the icon can't show — the bell would just stay
    // hollow with no reason given.
    if (result === 'unavailable') {
      Alert.alert(
        t`Reminders need a rebuild`,
        t`This development build predates the Reminders module — run make rebuild-ios.`,
      );
    } else if (result === 'denied') {
      Alert.alert(
        t`Reminders access needed`,
        t`Allow TraderMemos to add reminders in Settings › Privacy › Reminders.`,
      );
    } else if (result === 'failed') {
      Alert.alert(t`Couldn't add the reminder`, t`No writable list was found in Reminders.`);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: headerHeight }]}>
      <Stack.Screen
        options={{
          title: t`Economic calendar`,
          headerLargeTitle: false,
          headerRight: () => (
            <View style={styles.headerActions}>
              <SearchToggle
                open={searching}
                active={needle.length > 0}
                label={t`Search events`}
                onPress={() => {
                  if (searching) setQuery('');
                  setSearching((open) => !open);
                }}
              />
              <EventFilterMenu
                onReset={clearFilters}
                groups={[
                  {
                    key: 'impact',
                    title: t`Impact`,
                    icon: 'exclamationmark.triangle',
                    options: IMPACTS.map((impact) => ({
                      value: impact,
                      label: impactLabel(impact),
                    })),
                    selected: impacts,
                    onToggle: toggle('impacts'),
                  },
                  {
                    key: 'currency',
                    title: t`Currency`,
                    icon: 'dollarsign.circle',
                    options: weekCurrencies.map((code) => ({
                      value: code,
                      label: currencyLabel(code),
                    })),
                    selected: currencies,
                    onToggle: toggle('currencies'),
                  },
                ]}
              />
            </View>
          ),
        }}
      />

      {/* Pinned. It reports where the timeline is rather than deciding what the
          timeline shows — swiping it scrolls the list to that week. */}
      <View style={styles.controls} onLayout={(e) => setPageWidth(e.nativeEvent.layout.width)}>
        <View style={styles.pager}>
          <ScrollView
            ref={pagerRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            // Always re-centred, so the settled page is the one you swiped to and
            // never drifts after the data behind it changes.
            onContentSizeChange={() => {
              if (pageWidth > 0) pagerRef.current?.scrollTo({ x: pageWidth, animated: false });
            }}
            onMomentumScrollEnd={onPagerSettled}
          >
            {PAGES.map((offset) => {
              const start = addDaysKey(visibleWeek, offset * 7);
              return (
                <WeekPage
                  key={start}
                  label={formatWeekLabel(start, locale, todayKey)}
                  days={weekDays(start)}
                  todayKey={todayKey}
                  width={pageWidth}
                  onSelectDay={(day) => scrollToKey(day, true)}
                />
              );
            })}
          </ScrollView>

          {/* Rides the pager's own box so it lines up with the week label. */}
          <TodayButton visible={visibleWeek !== todayWeek} onPress={() => jumpToWeek(todayWeek)} />
        </View>
      </View>

      <View style={styles.list}>
        {pinnedDay ? (
          <View style={styles.pinnedDay} pointerEvents="none">
            <View style={styles.dayRail} />
            <DayChip day={pinnedDay} isToday={pinnedDay === todayKey} />
          </View>
        ) : null}
        <ScrollView
          ref={scrollRef}
          style={styles.listScroll}
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={styles.content}
          // Weeks are prepended when you reach the start; without this the new
          // content above would shove everything down under your thumb. Safe
          // now that the pinned day is drawn by hand — RN's own sticky headers
          // and this prop together pinned an empty clone of the day row.
          maintainVisibleContentPosition={{ minIndexForVisible: 1 }}
          scrollEventThrottle={32}
          onScroll={onScroll}
          onScrollEndDrag={onScrollSettled}
          onMomentumScrollEnd={onScrollSettled}
          refreshControl={
            // Only a pull spins. A week change refetches too, and letting
            // `isRefetching` drive this put a spinner on screen every time you
            // swiped — that's what the skeleton is for.
            <RefreshControl refreshing={pulling} onRefresh={pullToRefresh} />
          }
        >
          {loading ? (
            <TimelineSkeleton />
          ) : unconfigured ? (
            <AppHost style={styles.emptyHost}>
              <EmptyState
                title={t`Calendar not configured`}
                systemImage="newspaper"
                description={t`The server has no economic-calendar provider configured.`}
              />
            </AppHost>
          ) : events.error && events.data == null ? (
            // Only when the persisted cache is empty too — a week already
            // fetched stays readable offline. Sized like the empty host: the
            // failure sits inside scroll content with no height of its own.
            <View style={styles.emptyHost}>
              <ErrorState
                error={events.error}
                onRetry={() => void events.refetch()}
                retrying={events.isRefetching}
              />
            </View>
          ) : (
            rows.map((row, index) => {
              if (row.kind === 'day') {
                return (
                  <View
                    key={`day-${row.day}`}
                    style={styles.dayHeader}
                    onLayout={(e) => {
                      setStickyHeight(e.nativeEvent.layout.height);
                      // A host `onLayout` only fires after commit, so the refs
                      // inside `remember` are never read during render — the rule
                      // can't see that here, though it accepts the same call
                      // through EventRow's `onMeasure` prop.
                      // eslint-disable-next-line react-hooks/refs
                      remember(row.day, e.nativeEvent.layout.y);
                    }}
                  >
                    {index > 0 ? <View style={styles.dayRail} /> : null}
                    <DayChip day={row.day} isToday={row.day === todayKey} />
                  </View>
                );
              }
              if (row.kind === 'gap') {
                return (
                  <View
                    key={`gap-${row.week}`}
                    style={styles.gapRow}
                    onLayout={(e) => remember(row.week, e.nativeEvent.layout.y)}
                  >
                    <View style={styles.dayRail} />
                    <Text style={styles.gapText}>
                      {formatWeekLabel(row.week, locale, todayKey)} · {t`No events`}
                    </Text>
                  </View>
                );
              }
              return (
                <EventRow
                  key={row.event.id}
                  event={row.event}
                  now={now.getTime()}
                  isFirst={index === firstEvent}
                  isLast={index === lastEvent}
                  bookmarked={bookmarks[row.event.id] != null}
                  onBookmark={() => void bookmark(row.event)}
                  onMeasure={(y) => remember(row.event.id.toString(), y)}
                />
              );
            })
          )}
        </ScrollView>
      </View>
      <FloatingSearchBar
        open={searching}
        value={query}
        placeholder={t`Search events`}
        onChangeText={setQuery}
        onClose={() => {
          setQuery('');
          setSearching(false);
        }}
      />
    </View>
  );
}
const styles = StyleSheet.create((theme) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  list: { flex: 1, overflow: 'hidden' },
  listScroll: { flex: 1 },
  // Floats over the timeline, opaque, so rows pass behind it.
  pinnedDay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: theme.spacing.lg + RAIL_WIDTH,
    paddingRight: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.background,
  },
  // Absolute so an outgoing week can slide out over the incoming one instead of
  // stacking below it for a frame.
  weekLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  // No horizontal padding here — the sticky day headers have to reach both
  // edges, or scrolled rows peek through the gutters beside them.
  content: { paddingBottom: theme.spacing.xl * 3 },

  controls: { paddingBottom: theme.spacing.sm, gap: theme.spacing.sm },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  pager: { justifyContent: 'flex-start' },
  page: { gap: theme.spacing.xs, paddingHorizontal: theme.spacing.lg },
  weekLabel: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
    color: theme.colors.foreground,
    ...theme.numeric,
  },
  pressed: { opacity: 0.6 },
  todayHolder: { position: 'absolute', top: 0, right: theme.spacing.lg },
  todayButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.muted,
  },
  todayLabel: { fontSize: 12, fontWeight: '600', color: theme.colors.foreground },

  strip: { flexDirection: 'row', alignItems: 'flex-end' },
  stripCell: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: theme.spacing.xs },
  stripWeekday: { fontSize: 11, fontWeight: '600', color: theme.colors.mutedForeground },
  stripDate: {
    width: 26,
    height: 26,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripDateToday: { backgroundColor: theme.colors.primary },
  stripDay: { fontSize: 14, fontWeight: '600', color: theme.colors.foreground, ...theme.numeric },
  stripDayToday: { color: theme.colors.primaryForeground },
  // Fixed track so the bars grow from a shared baseline instead of shoving the
  // dates around as the week's busiest day changes.
  stripTrack: { height: BAR_MAX, justifyContent: 'flex-end' },
  stripBar: { width: 4, borderRadius: 2, borderCurve: 'continuous' },
  stripEmpty: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    marginBottom: 1,
    backgroundColor: theme.colors.input,
  },

  // Full-bleed backdrop, so rows passing under the pinned header are hidden…
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: theme.spacing.lg + RAIL_WIDTH,
    paddingRight: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.background,
  },
  // …and a rounded surface inside it, hugging the date so the rail still runs
  // down its left instead of through it.
  dayChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.muted,
  },
  // Absolute rather than a flex rail column: RN's sticky-header wrapper
  // collapses an empty fixed-width child, which broke the thread at every day.
  dayRail: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: theme.spacing.lg + (RAIL_WIDTH - 1) / 2,
    width: 1,
    backgroundColor: theme.colors.input,
  },
  dayTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: theme.colors.mutedForeground,
  },
  // Solid, like the strip's today circle — the two "you are here" marks on this
  // screen should look like the same mark.
  todayTag: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.primary,
  },
  todayTagLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: theme.colors.primaryForeground,
  },

  eventRow: { flexDirection: 'row', paddingHorizontal: theme.spacing.lg },
  rail: { width: RAIL_WIDTH, alignSelf: 'stretch' },
  railLine: {
    position: 'absolute',
    left: (RAIL_WIDTH - 1) / 2,
    width: 1,
    backgroundColor: theme.colors.input,
  },
  railAbove: { top: 0, height: DOT_TOP },
  railBelow: { top: DOT_TOP + DOT_SIZE, bottom: 0 },
  dot: {
    position: 'absolute',
    top: DOT_TOP,
    left: (RAIL_WIDTH - DOT_SIZE) / 2,
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
  past: { opacity: 0.55 },
  // The gap between rows belongs to the *body*: children lay out inside the
  // content box, so a row `paddingBottom` would fall outside the stretched rail
  // and break the line at every gap.
  eventBody: { flex: 1, gap: 4, paddingBottom: theme.spacing.xl },
  eventMeta: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  metaSpacer: { flex: 1 },
  eventTime: { fontSize: 12, color: theme.colors.mutedForeground, ...theme.numeric },
  eventCurrency: { fontSize: 12, fontWeight: '600', color: theme.colors.mutedForeground },
  eventTitle: { fontSize: 15, fontWeight: '600', lineHeight: 20, color: theme.colors.foreground },
  // Tokens rather than a run of loose words: each figure gets its own surface,
  // so a released number reads as a value and not as more label text.
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs + 2, paddingTop: 3 },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs + 1,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderRadius: theme.radius.sm,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.muted,
  },
  statStrong: { backgroundColor: `${theme.colors.primary}1F` },
  // One size for both halves of the token — the label carries its role in the
  // color and the caps, not in being smaller than the number.
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: theme.colors.mutedForeground,
  },
  statValue: { fontSize: 11, fontWeight: '700', color: theme.colors.foreground, ...theme.numeric },
  statValueStrong: { color: theme.colors.primary },

  // A week with no releases still occupies the thread, so the rail stays
  // unbroken and the scroll has something to report from.
  gapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: theme.spacing.lg + RAIL_WIDTH,
    paddingRight: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
  },
  gapText: { fontSize: 12, color: theme.colors.mutedForeground, ...theme.numeric },

  dotIdle: { backgroundColor: theme.colors.input },
  skeletonMeta: { width: 132, height: 11, borderRadius: theme.radius.sm },
  skeletonTitle: { width: '72%', height: 15, borderRadius: theme.radius.sm, marginTop: 5 },
  skeletonTitleShort: { width: '48%' },
  empty: { alignItems: 'center', gap: theme.spacing.md, paddingHorizontal: theme.spacing.lg },
  emptyHost: { minHeight: 280, alignSelf: 'stretch' },
  clearButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.full,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.muted,
  },
  clearButtonLabel: { fontSize: 14, fontWeight: '600', color: theme.colors.foreground },
}));
