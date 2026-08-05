/**
 * Shared access to the iOS Reminders app.
 *
 * Two features write reminders — bookmarked economic releases and the daily
 * checklist — and both want the same two things: a native module that may not
 * be in the running binary, and one list of our own to write into instead of
 * scattering rows through the user's personal default list.
 */

import { requireOptionalNativeModule } from 'expo-modules-core';

import { storage } from '@/storage/mmkv';

export type CalendarModule = typeof import('expo-calendar');
export type ReminderList = Awaited<ReturnType<CalendarModule['getCalendars']>>[number];
export type Reminder = Awaited<ReturnType<ReminderList['listReminders']>>[number];

/**
 * Loaded on first use, never at module scope: `expo-calendar` throws
 * "Cannot find native module 'CalendarNext'" while evaluating, so a static
 * import takes the whole screen down in any dev build made before the
 * dependency was added. Lazy, the screen keeps working and only the feature
 * that needs reminders has to explain itself.
 *
 * The import is checked rather than trusted — under Metro's async require the
 * failed evaluation still *resolves*, handing back a namespace whose functions
 * are all undefined, so a bare try/catch sails past it and dies one line later
 * on `requestRemindersPermissions is not a function`.
 */
export async function loadCalendar(): Promise<CalendarModule | null> {
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

const LIST_ID_KEY = 'reminders:listId';
const LIST_TITLE = 'TraderMemos';
/** Signature blue (`theme.colors.primary`) so the list is recognisable. */
const LIST_COLOR = '#0490C8';

/**
 * The app's own Reminders list, created on first use.
 *
 * In the Reminders app a *group* is a folder of lists, and EventKit exposes no
 * way to make one — a list is as far as we can go. Anyone who wants it inside
 * a group can drag it there once and the cached id still resolves.
 *
 * Falls back to the default writable list if creation fails: a source that
 * won't hold reminders is a reason to write somewhere else, not to drop the
 * user's reminder on the floor.
 */
export async function traderMemosList(Calendar: CalendarModule): Promise<ReminderList | null> {
  const lists = await Calendar.getCalendars(Calendar.EntityTypes.REMINDER);
  const writable = lists.filter((list) => list.allowsModifications);

  const cachedId = storage.getString(LIST_ID_KEY);
  const cached = cachedId ? writable.find((list) => list.id === cachedId) : undefined;
  if (cached) return cached;

  // Deleted in the Reminders app, or created by an earlier install.
  const existing = writable.find((list) => list.title === LIST_TITLE);
  if (existing) {
    storage.set(LIST_ID_KEY, existing.id);
    return existing;
  }

  // The source of a list that already holds reminders is known to support
  // them; `getSourcesSync` also returns event-only accounts.
  const source = writable[0]?.source ?? Calendar.getSourcesSync()[0];
  try {
    const created = await Calendar.createCalendar({
      title: LIST_TITLE,
      entityType: Calendar.EntityTypes.REMINDER,
      color: LIST_COLOR,
      sourceId: source?.id,
      source,
    });
    if (created.id) {
      storage.set(LIST_ID_KEY, created.id);
      return created;
    }
  } catch {
    // Fall through to whatever list the device will take.
  }
  return writable[0] ?? lists[0] ?? null;
}

export type RemindersAccess = 'granted' | 'denied' | 'unavailable';

/** Permission plus module availability, as one answer a caller can report. */
export async function remindersAccess(
  Calendar: CalendarModule | null,
): Promise<RemindersAccess> {
  if (!Calendar) return 'unavailable';
  try {
    const { status } = await Calendar.requestRemindersPermissions();
    return status === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'unavailable';
  }
}
