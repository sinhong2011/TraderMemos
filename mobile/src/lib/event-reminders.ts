/**
 * Bookmarked economic releases, mirrored into the system Reminders app.
 *
 * Reminders rather than calendar events: a release is a thing to be alerted
 * about, not a block of time on your day — and the Reminders permission is the
 * narrower ask. The store keeps `economic event id → reminder id` so a
 * bookmarked row renders filled and can take itself back out again; that
 * mapping has to survive a relaunch or the link to the system reminder is lost.
 *
 * MMKV-persisted — the row that toggles a bookmark and the rows re-rendered by
 * it live in different subtrees.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { loadCalendar, traderMemosList } from '@/lib/ios-reminders';
import { mmkvStorage } from '@/storage/zustand-mmkv';

const PERSIST_KEY = 'store:event-reminders';

/** Minutes before the release the alarm fires — enough to get to the desk. */
const ALARM_LEAD_MINUTES = 15;

export type ReminderTarget = { id: number; title: string; time: string; country: string };

type Bookmarks = Record<string, string>;
type BookmarkState = { bookmarks: Bookmarks };

/** Drop any entry whose reminder id isn't a string — a half-written map must
 *  not make a bell tap throw. */
function sanitize(raw: unknown): Bookmarks {
  if (typeof raw !== 'object' || raw == null) return {};
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

const useReminderStore = create<BookmarkState>()(
  persist((): BookmarkState => ({ bookmarks: {} }), {
    name: PERSIST_KEY,
    storage: mmkvStorage<BookmarkState>(),
    merge: (persisted, current) => ({
      ...current,
      bookmarks: sanitize((persisted as BookmarkState | undefined)?.bookmarks),
    }),
  }),
);

function bookmarks(): Bookmarks {
  return useReminderStore.getState().bookmarks;
}

export function useEventBookmarks(): Bookmarks {
  return useReminderStore((state) => state.bookmarks);
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
    // events calendar and can't hold a reminder. Releases go in the app's own
    // list alongside the checklist, not scattered through a personal one.
    const list = await traderMemosList(Calendar);
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

    useReminderStore.setState((state) => ({
      bookmarks: { ...state.bookmarks, [event.id]: reminder.id },
    }));
    return 'added';
  } catch {
    return 'failed';
  }
}

async function remove(eventId: number): Promise<ReminderResult> {
  const reminderId = bookmarks()[eventId];
  useReminderStore.setState((state) => {
    const { [eventId]: _dropped, ...rest } = state.bookmarks;
    return { bookmarks: rest };
  });
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
  return bookmarks()[event.id] ? remove(event.id) : add(event);
}
