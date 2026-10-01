/**
 * Routine helpers that outlived the daily checklist.
 *
 * The checklist kept a day's ticks as `- [x]` lines in that day's daily log;
 * routines keep them as routine checks on the server (use-checklist-run.ts).
 * What is left here is the starter set and the day key both eras share.
 */

import { t } from '@lingui/core/macro';
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
 */
export function todayNoteDay(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
