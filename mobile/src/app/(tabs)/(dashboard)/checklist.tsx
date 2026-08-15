import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { Frame, Menu, Sortable, Swipe, Text as UIText, reorderItems } from 'panelui-native';
import { Alert, Pressable } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { queryKeys, useApiRequest, useChecklistTemplate } from '@/api/hooks';
import type { ChecklistTemplate } from '@/api/types';
import { t } from '@lingui/core/macro';
import { Icon } from '@/components/icon';
import { SettingsButton, SettingsSection, SettingsToggle } from '@/components/settings-rows';
import { SettingsForm } from '@/components/settings-form';
import { usePrompt } from '@/components/use-prompt';
import { DateField } from '@/components/date-field';
import { preMarketRoutine, setWeekdaysOnly, taskBlock, useWeekdaysOnly } from '@/lib/checklist';
import {
  setRemindersSync,
  setRemindersTime,
  timeDate,
  timeString,
  useRemindersEnabled,
  useRemindersTime,
} from '@/lib/checklist-reminders';
import { errorMessage } from '@/lib/errors';

/**
 * Daily checklist template editor.
 *
 * Lives in the Home stack, not Settings: the routine is a start-of-day thing,
 * reached from the wrench menu or the card that runs it, and back should land
 * on Home. It still uses the settings *form* idiom — grouped sections of rows
 * with no Save button, each edit persisting on its own.
 *
 * Items are rows, not markdown: tap to rename, swipe to delete, drag the grip
 * to reorder, add from the bottom row, instead of asking anyone to hand-type
 * `- [ ]` into a textarea. The wire format stays the markdown `content` string
 * the web editor round-trips.
 */
export default function ChecklistScreen() {
  const [foreground, mutedForeground] = useCSSVariable([
    '--color-foreground',
    '--color-muted-foreground',
  ]) as [string, string];
  const queryClient = useQueryClient();
  const api = useApiRequest();
  // Single-value editing: `Alert.prompt` on iOS, a dialog everywhere else.
  const { prompt, element: promptElement } = usePrompt();
  const checklist = useChecklistTemplate();
  const items = checklist.data?.items ?? [];
  const weekdaysOnly = useWeekdaysOnly();
  const remindersOn = useRemindersEnabled();
  const remindersTime = useRemindersTime();

  // Compared case-insensitively because that is how the server folds
  // duplicates: an item typed as "check news events" already covers the
  // suggestion, and offering it again would only earn a clash alert.
  const taken = new Set(items.map((item) => item.toLowerCase()));
  const suggestions = checklist.isLoading
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
          ? t`Allow Reminders for TraderMemos in Settings → Privacy to mirror the checklist.`
          : t`This build can't reach the Reminders app. Rebuild the dev client and try again.`,
      );
    });
  }

  const save = useMutation({
    mutationFn: (next: string[]) =>
      api<ChecklistTemplate>('/settings/checklist-template', {
        method: 'PUT',
        body: { content: taskBlock(next) },
      }),
    // Written straight into the cache: a row that lags a round-trip behind the
    // tap that renamed it reads as a dropped edit.
    onMutate: (next) => {
      const previous = queryClient.getQueryData<ChecklistTemplate>(queryKeys.checklistTemplate());
      queryClient.setQueryData<ChecklistTemplate>(queryKeys.checklistTemplate(), {
        items: next,
        content: taskBlock(next),
      });
      return { previous };
    },
    onError: (err, _next, context) => {
      queryClient.setQueryData(queryKeys.checklistTemplate(), context?.previous);
      Alert.alert(t`Could not save checklist`, errorMessage(err));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.checklistTemplate() });
    },
  });

  /**
   * The server folds duplicates together case-insensitively, so a second copy
   * would silently vanish on the next load — refused here instead.
   */
  function commit(next: string[], added: string, atIndex: number) {
    const name = added.trim();
    if (!name) return;
    const clash = next.some(
      (item, index) => index !== atIndex && item.toLowerCase() === name.toLowerCase(),
    );
    if (clash) {
      Alert.alert(t`Already on the list`, t`“${name}” is already a checklist item.`);
      return;
    }
    save.mutate(next);
  }

  function promptAdd() {
    prompt({
      title: t`New item`,
      message: t`One rule to clear before you trade.`,
      confirmLabel: t`Add`,
      onSubmit: (value) => {
        const name = value.trim();
        if (name) commit([...items, name], name, items.length);
      },
    });
  }

  function promptRename(index: number) {
    prompt({
      title: t`Edit item`,
      defaultValue: items[index],
      onSubmit: (value) => {
        const name = value.trim();
        if (!name) return;
        commit(
          items.map((item, i) => (i === index ? name : item)),
          name,
          index,
        );
      },
    });
  }

  function remove(index: number) {
    save.mutate(items.filter((_, i) => i !== index));
  }

  /**
   * `Sortable` hands back the settled order alongside the indices it moved
   * between, so the list is rebuilt with the same helper the component used to
   * draw the drag — no index arithmetic of our own to get wrong.
   */
  function move(from: number, to: number) {
    save.mutate(reorderItems(items, from, to));
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
        <Menu.Content align="end" minWidth={240}>
          {suggestions.map((item) => (
            <Menu.Item key={item} onSelect={() => commit([...items, item], item, items.length)}>
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
        <SettingsSection
          title={t`Checklist`}
          footer={t`These run on Home each morning and seed every new daily log. Tap an item to edit it, swipe to delete, drag to reorder.`}
        >
          {/* Row IDs have to survive a rename, and the text is all the server
              gives us — so the index carries the identity and the text only
              makes it unique while two rows share one. */}
          <Sortable
            value={items.map((item, index) => `${index}-${item}`)}
            onReorder={(_order, { from, to }) => move(from, to)}
          >
            {items.map((item, index) => (
              <Sortable.Item key={`${index}-${item}`} id={`${index}-${item}`}>
                <Swipe fullSwipe={false}>
                  <Swipe.End>
                    <Swipe.Action
                      color="destructive"
                      icon={<Icon name="trash.fill" size={17} tintColor="#FFFFFF" />}
                      label={t`Delete`}
                      onPress={() => remove(index)}
                    />
                  </Swipe.End>
                  <Frame.Row divided={index > 0} onPress={() => promptRename(index)}>
                    <Frame.Content>
                      <Frame.Title>{item}</Frame.Title>
                    </Frame.Content>
                    {/* The reorder grip, in place of the position number: a row
                        already says where it sits in the run by sitting there,
                        and nothing said it could be moved. */}
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

          {/* A failed load has to be said out loud here: "No items yet" over a
              routine that exists on the server invites you to type it all again,
              and the Add row below is right there. */}
          {items.length === 0 ? (
            <Frame.Row>
              <Frame.Content>
                <UIText size="sm" muted>
                  {checklist.isLoading
                    ? t`Loading…`
                    : checklist.error
                      ? errorMessage(checklist.error)
                      : t`No items yet`}
                </UIText>
              </Frame.Content>
            </Frame.Row>
          ) : null}

          <SettingsButton systemImage="plus.circle.fill" label={t`Add item`} onPress={promptAdd} />
        </SettingsSection>

        <SettingsSection
          title={t`Schedule`}
          footer={t`Weekends hide the card on Home. Turn this off if you trade Saturday or Sunday sessions.`}
        >
          <SettingsToggle
            label={t`Weekdays only`}
            value={weekdaysOnly}
            onValueChange={setWeekdaysOnly}
          />
        </SettingsSection>

        <SettingsSection
          title={t`Reminders`}
          footer={
            remindersOn
              ? t`Each item becomes a reminder in your TraderMemos list. Completing one there ticks it here, and ticking it here completes it there.`
              : t`Mirror the checklist into the system Reminders app, so it reaches you on the lock screen, the Watch and Siri.`
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
      {promptElement}
    </>
  );
}
