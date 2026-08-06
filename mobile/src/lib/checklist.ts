/**
 * Running the daily checklist.
 *
 * The template (`/settings/checklist-template`) is the plan; a day's ticks
 * live in that day's `daily_log` note body as ordinary `- [x]` markdown — the
 * same lines the web editor writes and the notes list already counts. Keeping
 * the run in the note means Home, the note editor and web all read one source
 * of truth, with no new table and no per-device state to reconcile.
 *
 * Only markdown task lines are writable here. Older notes round-trip TipTap
 * HTML task lists (`checklistProgress` in markdown.ts reads both) — those stay
 * read-only, and a body with none simply has the block appended.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { t } from '@lingui/core/macro';
import { storage } from '@/storage/mmkv';
import { adoptLegacyValue, mmkvStorage } from '@/storage/zustand-mmkv';

export type ChecklistTask = { text: string; done: boolean };

/**
 * The pre-market routine offered to a template that hasn't taken them yet.
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

/** `- [ ] text` — box and label captured separately so a flip rewrites in place. */
const TASK_LINE = /^(\s*[-*+]\s+\[)([ xX])(\]\s*)(.*)$/;

/** Task items in a note body, in document order. */
export function parseTasks(body: string): ChecklistTask[] {
  const tasks: ChecklistTask[] = [];
  for (const line of body.split('\n')) {
    const match = TASK_LINE.exec(line);
    if (match) tasks.push({ text: match[4].trim(), done: match[2] !== ' ' });
  }
  return tasks;
}

/** Flip the task at `index` (document order) and return the rewritten body. */
export function toggleTask(body: string, index: number, done: boolean): string {
  let seen = -1;
  return body
    .split('\n')
    .map((line) => {
      const match = TASK_LINE.exec(line);
      if (!match) return line;
      seen += 1;
      if (seen !== index) return line;
      return `${match[1]}${done ? 'x' : ' '}${match[3]}${match[4]}`;
    })
    .join('\n');
}

/**
 * Markdown task lines for `items`, matching the server's
 * `checklistMarkdownFromItems` so the template round-trips byte-for-byte.
 * `doneIndex` ticks one box up front — the first tap on a day that has no run
 * yet both starts the checklist and records that tap.
 */
export function taskBlock(items: string[], doneIndex = -1): string {
  return items
    .map((item, index) => ({ text: item.trim(), done: index === doneIndex }))
    .filter((item) => item.text !== '')
    .map((item) => `- [${item.done ? 'x' : ' '}] ${item.text}`)
    .join('\n');
}

/** Append a labelled task block to a note body (new-note.tsx's shape). */
export function appendTaskBlock(body: string, block: string, label: string): string {
  const heading = `${label}:\n${block}`;
  const trimmed = body.trim();
  return trimmed ? `${trimmed}\n\n${heading}` : heading;
}

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

/**
 * Which days the card runs. MMKV-persisted rather than a server setting: the
 * template row holds items only, and a per-device answer is the right one
 * anyway — the same account read on a weekend machine shouldn't be told it has
 * a routine to clear.
 */
const PERSIST_KEY = 'store:checklist-schedule';
/** Pre-zustand key: a bare MMKV boolean. Removable — see lib/prefs-migration.ts. */
const WEEKDAYS_ONLY_KEY = 'checklist:weekdaysOnly';

type ScheduleState = { weekdaysOnly: boolean };

adoptLegacyValue<ScheduleState>(PERSIST_KEY, [WEEKDAYS_ONLY_KEY], () => {
  const stored = storage.getBoolean(WEEKDAYS_ONLY_KEY);
  return stored === undefined ? undefined : { weekdaysOnly: stored };
});

const useScheduleStore = create<ScheduleState>()(
  // Default on: a trading routine belongs to a trading day. Anyone who works
  // weekend sessions turns it off once.
  persist((): ScheduleState => ({ weekdaysOnly: true }), {
    name: PERSIST_KEY,
    storage: mmkvStorage<ScheduleState>(),
  }),
);

export function useWeekdaysOnly(): boolean {
  return useScheduleStore((state) => state.weekdaysOnly);
}

/** The same answer outside a render — the Reminders repeat rule follows it. */
export function runsWeekdaysOnly(): boolean {
  return useScheduleStore.getState().weekdaysOnly;
}

export function setWeekdaysOnly(next: boolean): void {
  useScheduleStore.setState({ weekdaysOnly: next });
}

/**
 * Saturday or Sunday on the device clock — the same clock `todayNoteDay` uses,
 * so the card and the log it writes agree about which day it is.
 */
export function isWeekend(date = new Date()): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Today as a note day-key. Local, not market time: notes are written against
 * the wall clock (`occurred_at` comes from the device date in note-form) and
 * the notes list labels "Today" the same way, so a market-clock key here would
 * disagree with every other note surface after the local date rolls over.
 */
export function todayNoteDay(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
