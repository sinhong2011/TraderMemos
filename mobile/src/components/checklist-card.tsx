import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useRef, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { queryKeys, useChecklistTemplate, useNotes } from '@/api/hooks';
import type { Note, NoteBody } from '@/api/types';
import { DashboardCard } from '@/components/dashboard-card';
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
 * Today's checklist, tickable in place (web has this on the New Note drawer;
 * mobile had nowhere to actually run the thing).
 *
 * The boxes are the day's `daily_log` note body — the first tap writes the
 * template into today's log, every tap after that flips a `- [ ]` in it. So a
 * run started here is the same object the note editor, the notes list badge
 * and the web app already show; nothing is stored on the side.
 *
 * Renders nothing until a template exists — the card is a routine to work
 * through, not a prompt to go set one up (DailyLossCard's rule).
 */
export function ChecklistCard() {
  const { theme } = useUnistyles();
  const router = useRouter();
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
   * The log this card created, before the notes query has refetched. Without
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
  /** No routine to run today — see the early return below. */
  const offDay = weekdaysOnly && isWeekend();

  // Mirrors the run into the Reminders app when that is switched on, and ticks
  // back anything completed over there. The day's rows go over before any of
  // them is ticked — a reminder that only appears once you have started working
  // the list has already missed the moment it exists for. An off-day sends
  // nothing: the card isn't running, so neither is the mirror.
  useChecklistReminderSync({
    day: today,
    tasks: offDay ? [] : rows,
    onPulled: (texts) => {
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

  if (items.length === 0) return null;
  // Off-days hide the card rather than showing an untouched 0/7 — an unrun
  // checklist on a Saturday reads as a routine you skipped.
  if (offDay) return null;

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

  return (
    <DashboardCard
      title={t`Daily checklist`}
      action={{
        label: t`Edit`,
        onPress: () => router.push('/(tabs)/(dashboard)/checklist'),
      }}
    >
      <View style={styles.head}>
        <Text style={styles.count}>
          {done}/{rows.length}
        </Text>
        <Text style={styles.status}>
          {done === rows.length ? t`Ready to trade` : t`Before the open`}
        </Text>
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            {
              width: `${Math.max((done / rows.length) * 100, done > 0 ? 3 : 0)}%`,
              backgroundColor: done === rows.length ? theme.colors.profit : theme.colors.primary,
            },
          ]}
        />
      </View>
      <View style={styles.rows}>
        {rows.map((row, index) => (
          <Pressable
            key={`${index}-${row.text}`}
            onPress={() => toggle(index, !row.done)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: row.done }}
            accessibilityLabel={row.text}
            hitSlop={4}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <SymbolView
              name={row.done ? 'checkmark.circle.fill' : 'circle'}
              size={20}
              tintColor={row.done ? theme.colors.profit : theme.colors.mutedForeground}
            />
            <Text style={[styles.label, row.done && styles.labelDone]}>{row.text}</Text>
          </Pressable>
        ))}
      </View>
    </DashboardCard>
  );
}

const styles = StyleSheet.create((theme) => ({
  head: { flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing.sm },
  count: { fontSize: 22, fontWeight: '700', color: theme.colors.foreground, ...theme.numeric },
  status: { fontSize: 13, color: theme.colors.mutedForeground },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: theme.colors.muted,
  },
  fill: { height: '100%', borderRadius: 3 },
  rows: { gap: theme.spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  pressed: { opacity: 0.6 },
  label: { flex: 1, fontSize: 15, color: theme.colors.foreground },
  labelDone: { color: theme.colors.mutedForeground, textDecorationLine: 'line-through' },
}));
