import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Alert } from 'react-native';

import { queryKeys, useChecklistTemplate, useNotes } from '@/api/hooks';
import type { Note, NoteBody } from '@/api/types';
import { t } from '@lingui/core/macro';
import {
  appendTaskBlock,
  isWeekend,
  parseTasks,
  taskBlock,
  toggleTask,
  todayNoteDay,
  useWeekdaysOnly,
} from '@/lib/checklist';
import { useChecklistReminderSync } from '@/lib/checklist-reminders';
import { errorMessage } from '@/lib/errors';
import { applyPendingNotes, usePendingOps } from '@/lib/outbox';
import { useQueuedNoteOps } from '@/lib/use-outbox';

/**
 * Today's checklist run — the state the Home card and the Daily checklist
 * screen share (web has this on the New Note drawer).
 *
 * The boxes are the day's `daily_log` note body — the first toggle writes the
 * template into today's log, every toggle after that flips a `- [ ]` in it. So
 * a run started here is the same object the note editor, the notes list badge
 * and the web app already show; nothing is stored on the side.
 *
 * `sync` mirrors the run into the Reminders app (when that is switched on) and
 * ticks back anything completed over there. Exactly one always-mounted caller
 * passes it — the Home card — so the mirror runs once, not once per screen
 * that happens to be showing the run.
 */
export function useChecklistRun({ sync = false }: { sync?: boolean } = {}) {
  const queryClient = useQueryClient();
  // Queue-aware saves: a tick with the server unreachable lands in the
  // offline outbox instead of an alert, and today's log may itself be a
  // queued create the overlay surfaces (lib/outbox.ts).
  const { createNote, updateNote } = useQueuedNoteOps();
  const pendingOps = usePendingOps();

  const template = useChecklistTemplate();
  const weekdaysOnly = useWeekdaysOnly();
  const today = todayNoteDay();
  // `from` only, filtered below: `occurred_at` is stored as written, so a `to`
  // bound would drop a log saved with a time component on the same day.
  const notesFilter = { from: today };
  const notes = useNotes(notesFilter);
  const serverLog = applyPendingNotes(notes.data, pendingOps, notesFilter).find(
    (note) => note.type === 'daily_log' && note.occurred_at.slice(0, 10) === today,
  );

  /** Optimistic body, held until the invalidated notes query catches up. */
  const [draft, setDraft] = useState<string | null>(null);
  /**
   * The log this run created, before the notes query has refetched. Without
   * it a second tap arriving in that window would see no log and post a
   * *second* daily log for the day.
   */
  const created = useRef<{ day: string; note: Note } | null>(null);
  // Writes queue behind each other: every save sends the whole body, so two in
  // flight at once would race and the loser would restore its stale copy.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const inFlight = useRef(0);

  const save = useMutation({
    mutationFn: (body: string) => {
      const run = queue.current.then(async () => {
        // Read inside the queued step, not at call time: an earlier tap in the
        // same batch may have just created the note this one has to patch.
        const target =
          serverLog ?? (created.current?.day === today ? created.current.note : undefined);
        if (target) {
          return updateNote(target.id, {
            type: 'daily_log',
            occurred_at: target.occurred_at,
            title: target.title,
            body,
            symbols: target.symbols,
          } satisfies NoteBody);
        }
        const { note } = await createNote({
          type: 'daily_log',
          occurred_at: today,
          body,
        } satisfies NoteBody);
        created.current = { day: today, note };
        return note;
      });
      queue.current = run.catch(() => undefined);
      return run;
    },
    onMutate: () => {
      inFlight.current += 1;
    },
    onError: (err) => Alert.alert(t`Could not save`, errorMessage(err)),
    // The draft only stands down once the queue has drained and the refetched
    // note carries every tap — dropping it between two queued writes would
    // flash the boxes back to their pre-tap state.
    onSettled: async () => {
      inFlight.current -= 1;
      if (inFlight.current > 0) return;
      await queryClient.invalidateQueries({ queryKey: queryKeys.notes(notesFilter) });
      setDraft(null);
    },
  });

  const items = template.data?.items ?? [];
  // `created` is deliberately not consulted here — it exists for the queue,
  // and the draft already covers the render between a tap and its refetch.
  const body = draft ?? serverLog?.body ?? '';
  const tasks = parseTasks(body);
  // Before the day's first tick there is no run yet — the template stands in,
  // every box open.
  const started = tasks.length > 0;
  const rows = started ? tasks : items.map((text) => ({ text, done: false }));
  const done = rows.filter((row) => row.done).length;
  /** No routine to run today (weekdays-only template on a weekend). */
  const offDay = weekdaysOnly && isWeekend();

  // The day's rows go over before any of them is ticked — a reminder that only
  // appears once you have started working the list has already missed the
  // moment it exists for. An off-day (or a non-`sync` caller) sends nothing.
  useChecklistReminderSync({
    day: today,
    tasks: sync && !offDay ? rows : [],
    onPulled: (texts) => {
      if (!sync) return;
      // Today's log may exist and simply not have arrived yet; the same guess
      // `toggle` refuses to make.
      if (notes.isLoading) return;
      const wanted = new Set(texts);
      // Completing a reminder before the first tap starts the day's run, just
      // as tapping the box here would.
      const base = started ? body : appendTaskBlock(body, taskBlock(items), t`Checklist`);
      let updated = base;
      parseTasks(base).forEach((task, index) => {
        if (!task.done && wanted.has(task.text)) updated = toggleTask(updated, index, true);
      });
      // Nothing matched an open box: an unstarted day stays unstarted rather
      // than being logged for a tick that isn't there.
      if (updated === base) return;
      setDraft(updated);
      save.mutate(updated);
    },
  });

  function toggle(index: number, next: boolean) {
    // Today's log may exist and simply not have arrived yet; starting a run on
    // top of that guess would strand the real one.
    if (notes.isLoading) return;
    const updated = started
      ? toggleTask(body, index, next)
      : appendTaskBlock(body, taskBlock(items, index), t`Checklist`);
    setDraft(updated);
    save.mutate(updated);
  }

  return {
    /** The day's boxes — the run when started, the template standing in before. */
    rows,
    done,
    /** False until a template exists — nothing to run, nothing to show. */
    hasTemplate: items.length > 0,
    offDay,
    toggle,
  };
}
