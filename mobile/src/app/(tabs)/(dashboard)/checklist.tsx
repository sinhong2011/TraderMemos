import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { Frame, Sortable, Text as UIText, reorderItems } from 'panelui-native';
import { Alert, Pressable } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { queryKeys, useApiRequest, useRoutineItems } from '@/api/hooks';
import type { RoutineItem, RoutineStage } from '@/api/types';
import { t } from '@lingui/core/macro';
import { Icon } from '@/components/icon';
import { SettingsButton, SettingsSection, SettingsToggle } from '@/components/settings-rows';
import { SettingsForm } from '@/components/settings-form';
import { Menu } from '@/components/sheet-menu';
import { Swipe } from '@/components/swipe';
import { DateField } from '@/components/date-field';
import { preMarketRoutine, useRoutineToday } from '@/lib/checklist';
import {
  setRemindersSync,
  setRemindersTime,
  timeDate,
  timeString,
  useRemindersEnabled,
  useRemindersTime,
} from '@/lib/checklist-reminders';
import { errorMessage } from '@/lib/errors';
import { MON_TO_FRI, STAGES, stageLabel, weekdaysLabel } from '@/lib/routines';

/**
 * Routine editor.
 *
 * Lives in the Home stack, not Settings: the routine is a start-of-day thing,
 * reached from the Home card's Edit or the Daily routine screen's pencil, and
 * back should land where the run is. It still uses the settings *form* idiom —
 * grouped sections of rows with no Save button, each edit persisting on its
 * own.
 *
 * One section per stage. Tap a row to edit it (its own form: title, stage,
 * days), swipe to remove it from the routine from today on, drag the grip to
 * reorder within the stage, add from each section's bottom row.
 */
export default function ChecklistScreen() {
  const [foreground, mutedForeground] = useCSSVariable([
    '--color-foreground',
    '--color-muted-foreground',
  ]) as [string, string];
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApiRequest();
  // The routine's day (market clock): adds start and removals end on the day
  // the run is showing, not on a wall-clock date ahead of it.
  const { day: today } = useRoutineToday();
  const routine = useRoutineItems(today);
  const items = routine.data?.items ?? [];
  const remindersOn = useRemindersEnabled();
  const remindersTime = useRemindersTime();

  // Compared case-insensitively: an item typed as "check news events" already
  // covers the suggestion.
  const taken = new Set(items.map((item) => item.title.toLowerCase()));
  const suggestions = routine.isLoading
    ? []
    : preMarketRoutine().filter((item) => !taken.has(item.toLowerCase()));

  /**
   * The switch only settles once the OS has answered: a refused permission has
   * to leave it off, and say why, rather than showing a mirror that isn't
   * running. The row reads `remindersOn`, which the store only flips on a
   * granted permission, so a refusal springs it back on its own.
   */
  function handleRemindersToggle(next: boolean) {
    void setRemindersSync(next).then((result) => {
      if (result === 'on' || result === 'off') return;
      Alert.alert(
        result === 'denied' ? t`Reminders access needed` : t`Reminders unavailable`,
        result === 'denied'
          ? t`Allow Reminders for TraderMemos in Settings → Privacy to mirror the routine.`
          : t`This build can't reach the Reminders app. Rebuild the dev client and try again.`,
      );
    });
  }

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.routines() });
  const onError = (err: unknown) => Alert.alert(t`Could not save`, errorMessage(err));

  const add = useMutation({
    mutationFn: (title: string) =>
      api<RoutineItem>('/routines', {
        method: 'POST',
        body: { title, stage: 'pre', weekdays: MON_TO_FRI, day: today },
      }),
    onSuccess: invalidate,
    onError,
  });

  const archive = useMutation({
    mutationFn: (id: string) => api<void>(`/routines/${id}?day=${today}`, { method: 'DELETE' }),
    onMutate: (id) => {
      // Gone from the list at once: a swiped row that springs back for a round
      // trip reads as a delete that didn't take.
      const key = queryKeys.routineItems(today);
      const previous = queryClient.getQueryData<{ items: RoutineItem[] }>(key);
      if (previous) {
        queryClient.setQueryData(key, { items: previous.items.filter((item) => item.id !== id) });
      }
      return { previous };
    },
    onError: (err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.routineItems(today), context.previous);
      onError(err);
    },
    onSettled: invalidate,
  });

  const order = useMutation({
    mutationFn: (ids: string[]) => api<void>('/routines/order', { method: 'PUT', body: { ids } }),
    onMutate: (ids) => {
      const key = queryKeys.routineItems(today);
      const previous = queryClient.getQueryData<{ items: RoutineItem[] }>(key);
      if (previous) {
        const byId = new Map(previous.items.map((item) => [item.id, item]));
        queryClient.setQueryData(key, {
          items: ids
            .map((id, position) => {
              const item = byId.get(id);
              return item ? { ...item, position } : undefined;
            })
            .filter((item): item is RoutineItem => item != null),
        });
      }
      return { previous };
    },
    onError: (err, _ids, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.routineItems(today), context.previous);
      onError(err);
    },
    onSettled: invalidate,
  });

  /** Reorder within one stage; positions are global, so every item is sent. */
  function move(stage: RoutineStage, from: number, to: number) {
    const stageItems = items.filter((item) => item.stage === stage);
    const moved = reorderItems(stageItems, from, to);
    const others = items.filter((item) => item.stage !== stage);
    order.mutate([...others, ...moved].map((item) => item.id));
  }

  /**
   * The starter routine, behind a header glyph rather than a section of its
   * own: every item is optional, and a standing block of things we think you
   * should be doing is furniture on a screen you opened to write your own.
   * Drops away entirely once all six have been taken.
   */
  const suggestionsMenu =
    suggestions.length === 0 ? null : (
      <Menu>
        <Menu.Trigger>
          <Pressable
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t`Suggested items`}
            className="h-8 w-8 items-center justify-center active:opacity-60"
          >
            <Icon name="sparkles" size={17} tintColor={foreground} />
          </Pressable>
        </Menu.Trigger>
        <Menu.Content>
          {suggestions.map((item) => (
            <Menu.Item key={item} onSelect={() => add.mutate(item)}>
              {item}
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu>
    );

  return (
    <>
      <Stack.Screen options={{ headerRight: () => suggestionsMenu }} />
      <SettingsForm>
        {STAGES.map((stage, sectionIndex) => {
          const stageItems = items.filter((item) => item.stage === stage);
          return (
            <SettingsSection
              key={stage}
              title={stageLabel(stage)}
              footer={
                sectionIndex === STAGES.length - 1
                  ? t`Tap an item to rename it or change its days, swipe to remove it from today on, drag to reorder.`
                  : undefined
              }
            >
              <Sortable
                value={stageItems.map((item) => item.id)}
                onReorder={(_order, { from, to }) => move(stage, from, to)}
              >
                {stageItems.map((item, index) => (
                  <Sortable.Item key={item.id} id={item.id}>
                    <Swipe>
                      <Swipe.End>
                        <Swipe.Action
                          color="destructive"
                          icon={<Icon name="trash.fill" />}
                          label={t`Remove`}
                          onPress={() => archive.mutate(item.id)}
                        />
                      </Swipe.End>
                      <Frame.Row
                        divided={index > 0}
                        onPress={() => router.push({ pathname: '/routine-item', params: { id: item.id } })}
                      >
                        <Frame.Content>
                          <Frame.Title>{item.title}</Frame.Title>
                          <Frame.Description>{weekdaysLabel(item.weekdays)}</Frame.Description>
                        </Frame.Content>
                        <Frame.Actions>
                          <Sortable.Handle>
                            <Icon name="line.3.horizontal" size={15} tintColor={mutedForeground} />
                          </Sortable.Handle>
                        </Frame.Actions>
                      </Frame.Row>
                    </Swipe>
                  </Sortable.Item>
                ))}
              </Sortable>

              {/* A failed load has to be said out loud: an empty stage over a
                  routine that exists on the server invites retyping it all. */}
              {stage === 'pre' && items.length === 0 ? (
                <Frame.Row>
                  <Frame.Content>
                    <UIText size="sm" muted>
                      {routine.isLoading
                        ? t`Loading…`
                        : routine.error
                          ? errorMessage(routine.error)
                          : t`No items yet`}
                    </UIText>
                  </Frame.Content>
                </Frame.Row>
              ) : null}

              <SettingsButton
                systemImage="plus.circle.fill"
                label={t`Add item`}
                onPress={() => router.push({ pathname: '/routine-item', params: { stage } })}
              />
            </SettingsSection>
          );
        })}

        <SettingsSection
          title={t`Reminders`}
          footer={
            remindersOn
              ? t`Each item becomes a reminder in your TraderMemos list, repeating on its own days. Completing one there ticks it here, and ticking it here completes it there.`
              : t`Mirror the routine into the system Reminders app, so it reaches you on the lock screen, the Watch and Siri.`
          }
        >
          <SettingsToggle
            label={t`Sync to Reminders`}
            value={remindersOn}
            onValueChange={handleRemindersToggle}
          />
          {remindersOn ? (
            <Frame.Row>
              <Frame.Content>
                <Frame.Title>{t`Due at`}</Frame.Title>
              </Frame.Content>
              <Frame.Actions>
                <DateField
                  selection={timeDate(remindersTime)}
                  displayedComponents={['hourAndMinute']}
                  onDateChange={(date) => setRemindersTime(timeString(new Date(date)))}
                />
              </Frame.Actions>
            </Frame.Row>
          ) : null}
        </SettingsSection>
      </SettingsForm>
    </>
  );
}
