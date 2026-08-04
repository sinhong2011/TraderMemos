/**
 * Bookmarked economic releases, mirrored into the system Reminders app.
 *
 * Reminders rather than calendar events: a release is a thing to be alerted
 * about, not a block of time on your day — and the Reminders permission is the
 * narrower ask. The store keeps `economic event id → reminder id` so a
 * bookmarked row renders filled and can take itself back out again; that
 * mapping has to survive a relaunch or the link to the system reminder is lost.
 *
 * MMKV-backed module store (reports-display.ts pattern) — the row that toggles
 * a bookmark and the rows re-rendered by it live in different subtrees.
 */

import { requireOptionalNativeModule } from 'expo-modules-core';
import { useSyncExternalStore } from 'react';

import { storage } from '@/storage/mmkv';

/**
 * Loaded on first use, never at module scope: `expo-calendar` throws
 * "Cannot find native module 'CalendarNext'" while evaluating, so a static
 * import takes the whole calendar screen down in any dev build made before the
 * dependency was added. Lazy, the screen keeps working and only the bell has to
 * explain itself.
 *
 * The import is checked rather than trusted — under Metro's async require the
 * failed evaluation still *resolves*, handing back a namespace whose functions
 * are all undefined, so a bare try/catch sails past it and dies one line later
 * on `requestRemindersPermissions is not a function`.
 */
async function loadCalendar(): Promise<typeof import('expo-calendar') | null> {
  // Asked for optionally first: importing the package when the native module is
  // missing throws while evaluating, and LogBox reports that as an uncaught
  // error over the app even though the failure is handled.
  if (requireOptionalNativeModule('CalendarNext') == null) return null;
  try {
    const module = await import('expo-calendar');
    return typeof module?.requestRemindersPermissions === 'function' ? module : null;
  } catch {
    return null;
  }
}

const STORAGE_KEY = 'events:reminders';

/** Minutes before the release the alarm fires — enough to get to the desk. */
const ALARM_LEAD_MINUTES = 15;

export type ReminderTarget = { id: number; title: string; time: string; country: string };

type Bookmarks = Record<string, string>;

function load(): Bookmarks {
  const raw = storage.getString(STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    );
  } catch {
    return {};
  }
}

let snapshot: Bookmarks = load();
const listeners = new Set<() => void>();

function publish(next: Bookmarks) {
  snapshot = next;
  storage.set(STORAGE_KEY, JSON.stringify(next));
  for (const listener of listeners) listener();
}

export function useEventBookmarks(): Bookmarks {
  return useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    () => snapshot,
  );
}

export type ReminderResult = 'added' | 'removed' | 'denied' | 'failed' | 'unavailable';

async function add(event: ReminderTarget): Promise<ReminderResult> {
  const Calendar = await loadCalendar();
  if (!Calendar) return 'unavailable';

  // Everything below talks to the native module. A bell tap must resolve to a
  // result the caller can explain, never to an unhandled rejection.
  try {
    const { status } = await Calendar.requestRemindersPermissions();
    if (status !== 'granted') return 'denied';

    // The Reminders app keeps its own lists — the default *calendar* is an
    // events calendar and can't hold a reminder.
    const lists = await Calendar.getCalendars(Calendar.EntityTypes.REMINDER);
    const list = lists.find((candidate) => candidate.allowsModifications) ?? lists[0];
    if (!list) return 'failed';

    const due = new Date(event.time);
    const reminder = await list.createReminder({
      title: `${event.country.toUpperCase()} · ${event.title}`,
      dueDate: due,
      // A reminder with no alarm never speaks up, which is the whole point here.
      // `absoluteDate` is typed as an ISO string, not a Date.
      alarms: [
        { absoluteDate: new Date(due.getTime() - ALARM_LEAD_MINUTES * 60_000).toISOString() },
      ],
    });
    if (!reminder.id) return 'failed';

    publish({ ...snapshot, [event.id]: reminder.id });
    return 'added';
  } catch {
    return 'failed';
  }
}

async function remove(eventId: number): Promise<ReminderResult> {
  const reminderId = snapshot[eventId];
  const { [eventId]: _dropped, ...rest } = snapshot;
  publish(rest);
  if (!reminderId) return 'removed';
  try {
    const Calendar = await loadCalendar();
    const reminder = await Calendar?.ExpoCalendarReminder.get(reminderId);
    await reminder?.delete();
  } catch {
    // Already gone from Reminders — the mapping is what mattered.
  }
  return 'removed';
}

/** Bookmark or un-bookmark a release. Callers surface `denied`/`failed`: a
 *  bookmark button that silently does nothing is worse than none at all. */
export function toggleEventReminder(event: ReminderTarget): Promise<ReminderResult> {
  return snapshot[event.id] ? remove(event.id) : add(event);
}
