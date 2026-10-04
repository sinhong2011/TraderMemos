/**
 * Routine helpers that outlived the daily checklist.
 *
 * The checklist kept a day's ticks as `- [x]` lines in that day's daily log;
 * routines keep them as routine checks on the server (use-checklist-run.ts).
 * What is left here is the starter set and the day keys: the note day (wall
 * clock) and the routine day (market clock).
 */

import { t } from '@lingui/core/macro';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { dayKeyInTz, nextDayStartMs } from '@/lib/events';
import { resolveMarketTimezone, useDisplayPrefs } from '@/lib/prefs';
import { storage } from '@/storage/mmkv';

/**
 * The pre-market routine offered to a routine that hasn't taken them yet.
 *
 * Six things worth clearing before the open, in the order a session actually
 * runs: what the market is doing, what is scheduled to move it, where the
 * levels are, what the risk is, what state you are in, and what your own rules
 * say. Every one is optional — they are offered a row at a time, and a routine
 * someone didn't choose is a list they have to clean up before they can use it.
 *
 * Translated, so they arrive in the language the app is already speaking; from
 * there on they are stored as plain text, exactly like typed ones.
 */
// These were briefly a section you had to wave off; they live behind a header
// button now, which is its own dismissal. Nothing left to remember.
storage.remove('checklist:suggestions:hidden');
// The device-wide "weekdays only" switch: each routine item carries its own
// days now, so the stored answer has nothing left to govern.
storage.remove('store:checklist-schedule');

export function preMarketRoutine(): string[] {
  return [
    t`Confirm market bias`,
    t`Check news events`,
    t`Mark key S/R levels`,
    t`Set stop loss targets`,
    t`Mental state self-score`,
    t`Confirm trade rules`,
  ];
}

/**
 * Today as a note day-key. Local, not market time: notes are written against
 * the wall clock (`occurred_at` comes from the device date in note-form) and
 * the notes list labels "Today" the same way, so a market-clock key here would
 * disagree with every other note surface after the local date rolls over.
 *
 * Not the routine's day — routine ticks key on the market day
 * ([useRoutineToday]).
 */
export function todayNoteDay(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * The routine's day key at `at`: the trading day on the market clock — the
 * bucketing trades, the calendar, missed trades and the weekly review use.
 *
 * Not the wall clock: a Hong Kong trader's New York session runs 21:30–04:00
 * HKT, and a local key put the pre-market ticks on one day and the
 * post-session journal tick on the next. A New York day runs midday HKT to
 * midday HKT, so it holds the whole session. The iOS widgets, Siri and the
 * Control Center controls key the same way (TMShared.today(), handed the zone
 * by widget-routine.ts).
 */
export function routineDay(marketTimezone: string, at: number = Date.now()): string {
  return dayKeyInTz(new Date(at).toISOString(), resolveMarketTimezone(marketTimezone));
}

/** Longest a mounted run goes without re-reading the clock. */
const RECHECK_MS = 60 * 60_000;

/**
 * Today's routine day, live: re-keys when the market timezone changes, at the
 * market midnight while the app stays open, and on every return to the
 * foreground. `localDay` is the wall-clock day beside it, for the one consumer
 * that lives on the device clock (the Reminders mirror).
 *
 * The clock is state rather than a `new Date()` read in render: React Compiler
 * caches a call with no reactive inputs for the life of the component, so a
 * render-time read would pin the run to the day the screen first mounted. And
 * the zone comes from the prefs hook, not the store at call time, so changing
 * it in Settings → Display re-keys every mounted run.
 */
export function useRoutineToday(): { day: string; localDay: string } {
  const { marketTimezone } = useDisplayPrefs();
  const tz = resolveMarketTimezone(marketTimezone);
  const [clock, setClock] = useState(() => Date.now());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const keys = (at: number) => `${routineDay(tz, at)}|${todayNoteDay(new Date(at))}`;
    const tick = () => {
      const now = Date.now();
      // Same day on both clocks keeps the old state: no re-render for nothing.
      setClock((prev) => (keys(prev) === keys(now) ? prev : now));
      arm();
    };
    function arm() {
      clearTimeout(timer);
      const now = Date.now();
      const local = new Date(now);
      const localMidnight = new Date(local.getFullYear(), local.getMonth(), local.getDate() + 1).getTime();
      const marketMidnight = nextDayStartMs(routineDay(tz, now), tz, now);
      // A second past whichever midnight comes first; capped, because a long
      // timer drifts across device sleep.
      const wait = Math.min(marketMidnight, localMidnight) - now + 1000;
      timer = setTimeout(tick, Math.max(1000, Math.min(wait, RECHECK_MS)));
    }
    arm();
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') tick();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [tz]);

  return { day: routineDay(tz, clock), localDay: todayNoteDay(new Date(clock)) };
}
