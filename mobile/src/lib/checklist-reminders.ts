/**
 * Mirroring the daily checklist into the iOS Reminders app.
 *
 * Each template item becomes one *repeating* reminder in the TraderMemos list,
 * due at the configured time — the Reminders app owns the schedule, so the
 * alarm arrives on mornings TraderMemos was never opened. Ticking a box here
 * completes that day's occurrence; completing it in Reminders (or on the Watch,
 * or by asking Siri) ticks the box here on the next foreground. The note body
 * stays the source of truth — reminders mirror it, they are not a second store.
 *
 * Reminders are matched to items **by title**, not by a stored id: completing a
 * repeating reminder retires that occurrence and the next one is a different
 * object, so an id map goes stale the first time anyone ticks a box.
 *
 * Merge rule is **done wins**: a pull only ever ticks boxes, never unticks
 * them. Without per-side change timestamps the symmetric rule flaps, and of
 * the two possible mistakes, silently unticking work someone did is the worse
 * one. Unticking in the app doesn't travel either — by then EventKit has moved
 * the series on to the next occurrence, and reopening a retired one would leave
 * the item sitting in Reminders twice.
 */

import type { DayOfTheWeek, RecurrenceRule } from 'expo-calendar';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { runsWeekdaysOnly, useWeekdaysOnly, type ChecklistTask } from '@/lib/checklist';
import {
  loadCalendar,
  remindersAccess,
  traderMemosList,
  type CalendarModule,
  type Reminder,
} from '@/lib/ios-reminders';
import { storage } from '@/storage/mmkv';
import { adoptLegacyValue, mmkvStorage } from '@/storage/zustand-mmkv';

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

const PERSIST_KEY = 'store:checklist-reminders';
/** Pre-zustand keys: a bare boolean and a bare `HH:MM` string. */
const ENABLED_KEY = 'checklist:reminders:on';
const TIME_KEY = 'checklist:reminders:time';

// The day-keyed `day -> item -> reminder id` map the one-off reminders needed.
// Titles carry that job now; the key is dropped rather than left to rot.
storage.remove('checklist:reminders:map');

type ReminderSettings = {
  /** Off until asked for: writing into someone's Reminders is not a default. */
  enabled: boolean;
  /** `HH:MM` on the device clock — the clock the run day is keyed by. */
  time: string;
};

adoptLegacyValue<ReminderSettings>(PERSIST_KEY, [ENABLED_KEY, TIME_KEY], () => {
  const enabled = storage.getBoolean(ENABLED_KEY);
  const time = storage.getString(TIME_KEY);
  if (enabled === undefined && time === undefined) return undefined;
  return { enabled: enabled ?? false, time: time ?? '09:00' };
});

const useReminderSettings = create<ReminderSettings>()(
  persist((): ReminderSettings => ({ enabled: false, time: '09:00' }), {
    name: PERSIST_KEY,
    storage: mmkvStorage<ReminderSettings>(),
  }),
);

/** Non-reactive read for the sync routines below. */
function settings(): ReminderSettings {
  return useReminderSettings.getState();
}

export function useRemindersEnabled(): boolean {
  return useReminderSettings((state) => state.enabled);
}

export function useRemindersTime(): string {
  return useReminderSettings((state) => state.time);
}

export function setRemindersTime(next: string): void {
  useReminderSettings.setState({ time: next });
}

export type EnableResult = 'on' | 'off' | 'denied' | 'unavailable';

/**
 * Turning the mirror on asks for Reminders access first — a switch that flips
 * and then quietly does nothing is worse than one that refuses to flip.
 */
export async function setRemindersSync(next: boolean): Promise<EnableResult> {
  if (!next) {
    useReminderSettings.setState({ enabled: false });
    // The reminders repeat, so switching the mirror off has to take them with
    // it — otherwise they keep ringing every morning for a routine nothing is
    // syncing any more, and the only way to stop them is the Reminders app.
    // Completed ones stay: that's a record of days worked, not a live alarm.
    await clearReminders();
    return 'off';
  }
  const access = await remindersAccess(await loadCalendar());
  if (access !== 'granted') return access === 'denied' ? 'denied' : 'unavailable';
  useReminderSettings.setState({ enabled: true });
  return 'on';
}

// ---------------------------------------------------------------------------
// Repeat
// ---------------------------------------------------------------------------

/**
 * Each item is one repeating reminder, not one reminder per item per day.
 *
 * The repeat is what makes the mirror arrive on time: a one-off reminder only
 * exists on days TraderMemos happened to be opened early enough to write it,
 * which is the one morning you didn't need reminding. Handing the recurrence to
 * the Reminders app means the alarm fires whether or not the app ran.
 *
 * Weekdays-only follows the card's own schedule — a routine that hides itself
 * on Saturday has no business ringing on Saturday.
 */
function repeatRule(Calendar: CalendarModule): RecurrenceRule {
  if (!runsWeekdaysOnly()) return { frequency: Calendar.Frequency.DAILY, interval: 1 };
  return {
    frequency: Calendar.Frequency.WEEKLY,
    interval: 1,
    daysOfTheWeek: WEEKDAYS_WRITTEN.map((dayOfTheWeek) => ({
      dayOfTheWeek: dayOfTheWeek as DayOfTheWeek,
    })),
  };
}

/**
 * Monday to Friday, spelled twice, because expo-calendar's two ends disagree
 * about which number a day is.
 *
 * Writing a rule goes through a native record whose day enum starts at
 * **Monday = 1** (`ios/Records/RecurrenceRuleRecords.swift`). Reading one back
 * hands over `EKWeekday`, which starts at **Sunday = 1** — and the exported
 * `DayOfTheWeek` enum agrees with the reader, not the writer. Passing that
 * exported enum straight through shifts every day forward one, and a weekdays
 * routine ends up ringing Tuesday to Saturday. Verified on the simulator.
 */
const WEEKDAYS_WRITTEN = [1, 2, 3, 4, 5];
const WEEKDAYS_READ = '2,3,4,5,6';

/** Whether a reminder already repeats the way the settings now say it should. */
function repeats(reminder: Reminder, rule: RecurrenceRule): boolean {
  const current = reminder.recurrenceRule;
  if (current?.frequency !== rule.frequency) return false;
  const days = (current.daysOfTheWeek ?? [])
    .map((day) => day.dayOfTheWeek)
    .sort((a, b) => a - b)
    .join(',');
  return days === (rule.daysOfTheWeek ? WEEKDAYS_READ : '');
}

/** `day` at `HH:MM` on the device clock. */
function dueAt(day: string, at: string): Date {
  const [year, month, date] = day.split('-').map(Number);
  const [hour, minute] = at.split(':').map(Number);
  return new Date(year, (month ?? 1) - 1, date ?? 1, hour ?? 9, minute ?? 0, 0, 0);
}

/** `HH:MM` from a picked Date, for the settings row. */
export function timeString(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** A Date carrying `HH:MM`, for seeding the picker. */
export function timeDate(at: string): Date {
  const [hour, minute] = at.split(':').map(Number);
  const date = new Date();
  date.setHours(hour ?? 9, minute ?? 0, 0, 0);
  return date;
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

/**
 * Reconcile the TraderMemos list with `tasks`. Returns the item texts that are
 * complete in Reminders but not yet ticked here, for the caller to write into
 * the note; `null` when there is nothing to report or nothing to sync with.
 */
export async function syncChecklistReminders(
  day: string,
  tasks: ChecklistTask[],
  at: string,
): Promise<string[] | null> {
  if (!settings().enabled || tasks.length === 0) return null;
  const Calendar = await loadCalendar();
  if (!Calendar || (await remindersAccess(Calendar)) !== 'granted') return null;
  const list = await traderMemosList(Calendar);
  if (!list) return null;

  const due = dueAt(day, at);
  const opens = new Date(due);
  opens.setHours(0, 0, 0, 0);
  const closes = new Date(opens);
  closes.setDate(closes.getDate() + 1);
  const rule = repeatRule(Calendar);
  const wanted = new Set(tasks.map((task) => task.text));

  // The live occurrence of each series, and whatever was struck off today —
  // completed reminders are filtered by completion date, open ones by due date,
  // so this is "what did we get done today" and "what is still standing".
  const [open, closed] = await Promise.all([
    list.listReminders(null, null, Calendar.ReminderStatus.INCOMPLETE),
    list.listReminders(opens, closes, Calendar.ReminderStatus.COMPLETED),
  ]);
  const doneToday = new Set(closed.map((reminder) => reminder.title));

  const live = new Map<string, Reminder>();
  const spare: Reminder[] = [];
  for (const reminder of open) {
    const title = reminder.title;
    if (title == null) continue;
    // One series per item. A second open copy is a leftover — from the days
    // this wrote one reminder per item per day, or from a template edit that
    // renamed an item back — and would ring twice for the same box.
    const held = live.get(title);
    if (!held) {
      live.set(title, reminder);
    } else if (dueTime(reminder) < dueTime(held)) {
      live.set(title, reminder);
      spare.push(held);
    } else {
      spare.push(reminder);
    }
  }

  const pulled: string[] = [];

  for (const task of tasks) {
    const reminder = live.get(task.text);
    if (!reminder) {
      // Nothing open, and nothing struck off today either: the series doesn't
      // exist yet (or EventKit ended it rather than rolling it forward).
      if (doneToday.has(task.text)) {
        if (!task.done) pulled.push(task.text);
        continue;
      }
      try {
        await list.createReminder({
          title: task.text,
          dueDate: due,
          // A reminder with no alarm never speaks up, which is the point.
          alarms: [{ absoluteDate: due.toISOString() }],
          recurrenceRule: rule,
          completed: task.done,
          completionDate: task.done ? new Date() : undefined,
        });
      } catch {
        // EventKit refused this one. The next pass retries it, rather than
        // taking the rest of the day's items down with it.
      }
      continue;
    }

    try {
      if (doneToday.has(task.text)) {
        // Already struck off today and rolled on to tomorrow; the open one is
        // the *next* occurrence and must be left alone.
        if (!task.done) pulled.push(task.text);
      } else if (task.done && dueTime(reminder) < closes.getTime()) {
        await reminder.update({ completed: true, completionDate: new Date() });
        continue;
      }
      // Settings moved, or the series is still sitting on an older day because
      // nobody ticked it. Both leave the reminder ringing at the wrong time.
      const stale = dueTime(reminder) < opens.getTime();
      if (stale || !repeats(reminder, rule)) {
        await reminder.update({
          ...(stale ? { dueDate: due, alarms: [{ absoluteDate: due.toISOString() }] } : {}),
          recurrenceRule: rule,
        });
      }
    } catch {
      // Deleted over in the Reminders app between the fetch and the write; the
      // next pass finds nothing open and starts the series again.
    }
  }

  // Items dropped from the template, plus the duplicate series set aside above.
  const retired = [...live.entries()]
    .filter(([title]) => !wanted.has(title))
    .map(([, reminder]) => reminder);
  for (const reminder of [...spare, ...retired]) {
    try {
      await reminder.delete();
    } catch {
      // Already gone, which was the goal.
    }
  }

  return pulled.length > 0 ? pulled : null;
}

/** Take down every standing reminder in the list, leaving the completed ones. */
async function clearReminders(): Promise<void> {
  try {
    const Calendar = await loadCalendar();
    if (!Calendar || (await remindersAccess(Calendar)) !== 'granted') return;
    const list = await traderMemosList(Calendar);
    if (!list) return;
    const open = await list.listReminders(null, null, Calendar.ReminderStatus.INCOMPLETE);
    for (const reminder of open) await reminder.delete();
  } catch {
    // Best effort: the switch is already off, and a reminder that outlives it
    // is not worth failing the toggle over.
  }
}

/** A reminder's due date as a timestamp; undated ones sort as far future. */
function dueTime(reminder: Reminder): number {
  const due = reminder.dueDate;
  if (due == null) return Number.MAX_SAFE_INTEGER;
  const at = new Date(due).getTime();
  return Number.isNaN(at) ? Number.MAX_SAFE_INTEGER : at;
}

/**
 * Keeps the mirror in step for as long as the card is mounted: on every change
 * to the day's boxes, and again whenever the app returns to the foreground —
 * which is when a tick made over in Reminders can first be noticed.
 */
export function useChecklistReminderSync({
  day,
  tasks,
  onPulled,
}: {
  day: string;
  tasks: ChecklistTask[];
  /** Item texts completed in Reminders but still open here. */
  onPulled: (texts: string[]) => void;
}): void {
  const enabledNow = useRemindersEnabled();
  const at = useRemindersTime();
  // Not read here, but the repeat rule is built from it: flipping the schedule
  // has to re-cut every reminder, not wait for the next launch.
  const weekdays = useWeekdaysOnly();
  // What the run reads, flattened to a value the effect can depend on without
  // re-firing for an unrelated re-render. Newline-joined because item text
  // contains spaces; the run reads the tasks themselves from the ref.
  const signature = tasks.map((task) => `${task.done ? '1' : '0'}${task.text}`).join('\n');
  const latest = useRef({ tasks, onPulled });
  const running = useRef(false);
  /** A tick that landed mid-run, owed a pass of its own. */
  const again = useRef(false);

  // Assigned in an effect rather than during render: the run reads these long
  // after the render that supplied them, and has to see the newest.
  useEffect(() => {
    latest.current = { tasks, onPulled };
  });

  useEffect(() => {
    if (!enabledNow) return;
    let cancelled = false;

    const run = async () => {
      // EventKit calls are slow enough that a foreground event landing mid-run
      // would otherwise duplicate every reminder it is still creating. The
      // second caller is owed a pass, though — creating the day's reminders
      // takes long enough to swallow the tick that arrives during it.
      if (running.current) {
        again.current = true;
        return;
      }
      running.current = true;
      try {
        const pulled = await syncChecklistReminders(day, latest.current.tasks, at);
        if (pulled && !cancelled) latest.current.onPulled(pulled);
      } catch {
        // EventKit is the one thing here that fails out of nowhere, and a
        // mirror falling behind is not worth an unhandled rejection over the
        // app. The next tick or foreground tries again.
      } finally {
        running.current = false;
      }
      if (again.current && !cancelled) {
        again.current = false;
        await run();
      }
    };

    void run();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void run();
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [enabledNow, at, weekdays, day, signature]);
}
