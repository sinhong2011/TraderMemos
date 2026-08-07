import {
  Button,
  DatePicker,
  HStack,
  Image as UIImage,
  List,
  Menu,
  Section,
  Spacer,
  Text as UIText,
  Toggle,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonStyle,
  foregroundStyle,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import { queryKeys, useApiRequest, useChecklistTemplate } from '@/api/hooks';
import type { ChecklistTemplate } from '@/api/types';
import { t } from '@lingui/core/macro';
import { SettingsForm } from '@/components/settings-form';
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
import { AppHost } from '@/components/app-host';

/**
 * Daily checklist template editor.
 *
 * Lives in the Home stack, not Settings: the routine is a start-of-day thing,
 * reached from the wrench menu or the card that runs it, and back should land
 * on Home. It still uses the settings *form* idiom — a SwiftUI `Form`, rows
 * with no Save button, each edit persisting on its own.
 *
 * Items are rows, not markdown: tap to rename, swipe to delete or move up, add
 * from the bottom row, instead of asking anyone to hand-type `- [ ]` into a
 * textarea. The wire format stays the markdown `content` string the web editor
 * round-trips.
 */
export default function ChecklistScreen() {
  const { theme } = useUnistyles();
  const queryClient = useQueryClient();
  const api = useApiRequest();
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
   * Remounts the switch to spring it back. SwiftUI's `Toggle` flips its own
   * state on tap and only follows `isOn` again when that value *changes* —
   * after a refusal it hasn't, since the mirror stayed off, so the switch would
   * sit there reading "on" over a mirror that isn't running.
   */
  const [toggleKey, setToggleKey] = useState(0);

  /**
   * The switch only settles once iOS has answered: a refused permission has to
   * leave it off, and say why, rather than showing a mirror that isn't running.
   */
  function handleRemindersToggle(next: boolean) {
    void setRemindersSync(next).then((result) => {
      if (result === 'on' || result === 'off') return;
      setToggleKey((key) => key + 1);
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
    Alert.prompt(
      t`New item`,
      t`One rule to clear before you trade.`,
      [
        { text: t`Cancel`, style: 'cancel' },
        {
          text: t`Add`,
          onPress: (value?: string) => {
            const name = (value ?? '').trim();
            if (name) commit([...items, name], name, items.length);
          },
        },
      ],
      'plain-text',
    );
  }

  function promptRename(index: number) {
    Alert.prompt(
      t`Edit item`,
      undefined,
      [
        { text: t`Cancel`, style: 'cancel' },
        {
          text: t`Save`,
          onPress: (value?: string) => {
            const name = (value ?? '').trim();
            if (!name) return;
            commit(
              items.map((item, i) => (i === index ? name : item)),
              name,
              index,
            );
          },
        },
      ],
      'plain-text',
      items[index],
    );
  }

  function remove(indices: number[]) {
    save.mutate(items.filter((_, index) => !indices.includes(index)));
  }

  /**
   * SwiftUI hands back `destination` as an index into the list *before* the
   * dragged rows come out of it, so the removals below it have to be counted
   * off before splicing them back in.
   */
  function move(sources: number[], destination: number) {
    const next = [...items];
    const dragged = sources.map((index) => next[index]);
    for (const index of [...sources].sort((a, b) => b - a)) next.splice(index, 1);
    const lifted = sources.filter((index) => index < destination).length;
    next.splice(destination - lifted, 0, ...dragged);
    save.mutate(next);
  }

  /**
   * The starter routine, behind a header glyph rather than a section of its
   * own: every item is optional, and a standing block of things we think you
   * should be doing is furniture on a screen you opened to write your own.
   * Drops away entirely once all six have been taken.
   */
  const suggestionsMenu =
    suggestions.length === 0 ? null : (
      <AppHost matchContents>
        <Menu
          label={<UIImage systemName="sparkles" size={17} />}
          modifiers={[
            buttonStyle('plain'),
            // Menu triggers default to the accent tint — keep the glyph neutral.
            tint(theme.colors.foreground),
            accessibilityLabel(t`Suggested items`),
          ]}
        >
          {suggestions.map((item) => (
            <Button
              key={item}
              label={item}
              systemImage="plus.circle"
              onPress={() => commit([...items, item], item, items.length)}
            />
          ))}
        </Menu>
      </AppHost>
    );

  return (
    <>
      <Stack.Screen options={{ headerRight: () => suggestionsMenu }} />
      <AppHost style={{ flex: 1 }}>
        <SettingsForm>
          <Section
            title={t`Checklist`}
            footer={
              <UIText>
                {t`These run on Home each morning and seed every new daily log. Tap an item to edit it, swipe to delete, drag to reorder.`}
              </UIText>
            }
          >
            {/* `List.ForEach` is what carries SwiftUI's own reordering and
                swipe-to-delete — the drag handle, the haptics and the row that
                slides out of the way are the system's, not a reimplementation. */}
            <List.ForEach onMove={move} onDelete={remove}>
              {items.map((item, index) => (
                <Button key={`${index}-${item}`} onPress={() => promptRename(index)}>
                  <HStack spacing={8}>
                    <UIText modifiers={[foregroundStyle({ type: 'hierarchical', style: 'primary' })]}>
                      {item}
                    </UIText>
                    <Spacer />
                    {/* iOS's own reorder grip, in place of the position
                        number: a row already says where it sits in the run by
                        sitting there, and nothing said it could be moved.
                        Quaternary, so it reads as an affordance and not as
                        something the item says. */}
                    <UIImage
                      systemName="line.3.horizontal"
                      size={15}
                      modifiers={[foregroundStyle({ type: 'hierarchical', style: 'quaternary' })]}
                    />
                  </HStack>
                </Button>
              ))}
            </List.ForEach>

            {/* A failed load has to be said out loud here: "No items yet" over
                a routine that exists on the server invites you to type it all
                again, and the Add row below is right there. Plain SwiftUI text
                rather than the app's InlineError — this row lives inside a
                native Form, which takes no RN children. */}
            {items.length === 0 ? (
              <UIText modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
                {checklist.isLoading
                  ? t`Loading…`
                  : checklist.error
                    ? errorMessage(checklist.error)
                    : t`No items yet`}
              </UIText>
            ) : null}

            <Button systemImage="plus.circle.fill" label={t`Add item`} onPress={promptAdd} />
          </Section>

          <Section
            title={t`Schedule`}
            footer={
              <UIText>
                {t`Weekends hide the card on Home. Turn this off if you trade Saturday or Sunday sessions.`}
              </UIText>
            }
          >
            <Toggle
              label={t`Weekdays only`}
              isOn={weekdaysOnly}
              onIsOnChange={setWeekdaysOnly}
            />
          </Section>

          <Section
            title={t`Reminders`}
            footer={
              <UIText>
                {remindersOn
                  ? t`Each item becomes a reminder in your TraderMemos list. Completing one there ticks it here, and ticking it here completes it there.`
                  : t`Mirror the checklist into the iOS Reminders app, so it reaches you on the lock screen, the Watch and Siri.`}
              </UIText>
            }
          >
            <Toggle
              key={toggleKey}
              label={t`Sync to Reminders`}
              isOn={remindersOn}
              onIsOnChange={handleRemindersToggle}
            />
            {remindersOn ? (
              <DatePicker
                title={t`Due at`}
                selection={timeDate(remindersTime)}
                displayedComponents={['hourAndMinute']}
                onDateChange={(date) => setRemindersTime(timeString(new Date(date)))}
              />
            ) : null}
          </Section>
        </SettingsForm>
      </AppHost>
    </>
  );
}
