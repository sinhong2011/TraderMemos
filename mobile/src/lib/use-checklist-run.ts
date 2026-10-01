import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert } from 'react-native';

import { queryKeys, useRoutineDay, useRoutineItems } from '@/api/hooks';
import type { RoutineStage } from '@/api/types';
import { t } from '@lingui/core/macro';
import { todayNoteDay } from '@/lib/checklist';
import { useChecklistReminderSync } from '@/lib/checklist-reminders';
import { errorMessage } from '@/lib/errors';
import { applyPendingChecks, usePendingOps } from '@/lib/outbox';
import { useQueuedRoutineCheck } from '@/lib/use-outbox';

export type RoutineRow = { id: string; text: string; stage: RoutineStage; done: boolean };

/**
 * Today's routine run — the state the Home card and the Daily checklist screen
 * share.
 *
 * Ticks are routine checks (`/routines/day/:day/items/:id`), one row per item
 * per day on the server, not `- [x]` lines in the day's daily log as the old
 * checklist kept them: that is what gives the routine a history, and it means
 * a tick can never fight a note edit over the same body. Offline, a tick lands
 * in the outbox and shows at once through `applyPendingChecks`.
 *
 * `sync` mirrors the routine into the Reminders app (when that is switched on)
 * and ticks back anything completed over there. Exactly one always-mounted
 * caller passes it — the Home card — so the mirror runs once, not once per
 * screen that happens to be showing the run.
 */
export function useChecklistRun({ sync = false }: { sync?: boolean } = {}) {
  const queryClient = useQueryClient();
  const today = todayNoteDay();
  const items = useRoutineItems(today);
  const day = useRoutineDay(today);
  const pendingOps = usePendingOps();
  const { saveCheck } = useQueuedRoutineCheck();

  /** Ticks shown before the server answers; cleared as each one settles. */
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});

  const data = applyPendingChecks(day.data, pendingOps);
  const rows: RoutineRow[] = (data?.items ?? []).map((item) => ({
    id: item.id,
    text: item.title,
    stage: item.stage,
    done: optimistic[item.id] ?? item.done,
  }));
  const done = rows.filter((row) => row.done).length;
  const active = items.data?.items ?? [];

  function settle(id: string) {
    setOptimistic((cur) => {
      const next = { ...cur };
      delete next[id];
      return next;
    });
  }

  function toggle(id: string, next: boolean) {
    setOptimistic((cur) => ({ ...cur, [id]: next }));
    saveCheck(today, id, next)
      .then((result) => {
        if (result.day) queryClient.setQueryData(queryKeys.routineDay(today), result.day);
        settle(id);
        void queryClient.invalidateQueries({ queryKey: ['routines', 'history'] });
      })
      .catch((err: unknown) => {
        settle(id);
        Alert.alert(t`Could not save`, errorMessage(err));
      });
  }

  // Every active item goes over, scheduled today or not — a series dropped on
  // its off-days would be deleted and recreated every week, and an alarm on a
  // day the app never opened is the whole point. Only today's items carry a
  // tick to mirror.
  const doneToday = new Map(rows.map((row) => [row.id, row.done]));
  useChecklistReminderSync({
    day: today,
    tasks: sync
      ? active.map((item) => ({
          text: item.title,
          weekdays: item.weekdays,
          today: doneToday.has(item.id),
          done: doneToday.get(item.id) ?? false,
        }))
      : [],
    onPulled: (texts) => {
      if (!sync || day.isLoading) return;
      const wanted = new Set(texts);
      for (const row of rows) {
        if (!row.done && wanted.has(row.text)) toggle(row.id, true);
      }
    },
  });

  return {
    /** The day's scheduled items, in stage order. */
    rows,
    done,
    /** False until the routine has any item — nothing to run, nothing to show. */
    hasTemplate: active.length > 0,
    /** Items exist, none of them on today's schedule. */
    offDay: active.length > 0 && day.data != null && rows.length === 0,
    loading: day.isLoading || items.isLoading,
    toggle,
  };
}
