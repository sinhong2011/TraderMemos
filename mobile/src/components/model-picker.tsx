import { t } from '@lingui/core/macro';
import { BottomSheet, cn, Frame, Input, Item, Text } from 'panelui-native';
import { Fragment, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, View } from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import { useCSSVariable } from 'uniwind';

import { Icon } from '@/components/icon';
import { groupModels, isLikelyVisionModel, modelLabel } from '@/lib/model-catalog';

export interface ModelPickerProps {
  /** The model id in force (saved or picked, not yet saved). */
  value: string;
  /** The endpoint's last listing — cached, so it is there before a refetch lands. */
  models: string[] | undefined;
  loading: boolean;
  /** Why the last listing failed; shown above whatever list is cached. */
  error?: string;
  /**
   * Hide ids that can't read a screenshot (TTS, embeddings, text-only
   * families) behind a "Show all" row. Vision scan only — the coach is text.
   */
  visionOnly: boolean;
  /** Fires as the sheet opens, so the listing can refresh behind the cache. */
  onOpen: () => void;
  onChange: (model: string) => void;
}

/**
 * The model row of an LLM settings form and the sheet it opens.
 *
 * A gateway lists dozens of models across vendors and modalities, which a
 * pull-down can't carry: this is a full-height sheet with one field that both
 * filters the list and takes an id the list doesn't have, the vendors as
 * headed groups, and the shared picker-row anatomy (52pt rows, separators,
 * trailing check — see `SettingsPicker`).
 */
export function ModelPicker({
  value,
  models,
  loading,
  error,
  visionOnly,
  onOpen,
  onChange,
}: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [mutedForeground, primary, destructive] = useCSSVariable([
    '--color-muted-foreground',
    '--color-primary',
    '--color-destructive',
  ]) as [string, string, string];
  // The list scrolls under the keyboard; a spacer of its height keeps the last
  // rows reachable while the search field has focus.
  const keyboard = useAnimatedKeyboard();
  const keyboardSpacer = useAnimatedStyle(() => ({ height: keyboard.height.value }));

  const all = models ?? [];
  const filterVision = visionOnly && !showAll;
  // The model in force always stays listed — even when it looks text-only, or
  // is a typed id the endpoint doesn't advertise: a sheet with no checked row
  // reads as the choice having been lost.
  const listed = value && !all.includes(value) ? [...all, value] : all;
  const shown = filterVision
    ? listed.filter((id) => id === value || isLikelyVisionModel(id))
    : listed;
  const hiddenCount = listed.length - shown.length;
  const groups = groupModels(shown, query);
  const trimmed = query.trim();
  const isCustom = trimmed !== '' && !all.includes(trimmed);

  function openSheet() {
    setQuery('');
    setOpen(true);
    onOpen();
  }

  function choose(id: string) {
    Keyboard.dismiss();
    onChange(id);
    setOpen(false);
  }

  const description = loading
    ? t`Loading models…`
    : all.length > 0
      ? t`${all.length} models on this endpoint`
      : undefined;

  return (
    <>
      <Frame.Row onPress={openSheet} accessibilityRole="button" accessibilityLabel={t`Model`}>
        <Frame.Content>
          <Frame.Title>{t`Model`}</Frame.Title>
        </Frame.Content>
        <Frame.Actions className="min-w-0 shrink justify-end">
          <Text size="sm" muted numberOfLines={1} ellipsizeMode="middle">
            {value || t`Default`}
          </Text>
          <Icon name="chevron.up.chevron.down" size={11} tintColor={mutedForeground} />
        </Frame.Actions>
      </Frame.Row>

      <BottomSheet open={open} onOpenChange={setOpen}>
        <BottomSheet.Content size="full">
          <BottomSheet.Header title={t`Model`} description={description} />
          <View className="pb-2">
            <Input
              value={query}
              onChangeText={setQuery}
              placeholder={t`Search or type a model id`}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => {
                if (trimmed) choose(trimmed);
              }}
              accessibilityLabel={t`Search models`}
              startContent={
                <View pointerEvents="none">
                  <Icon name="magnifyingglass" size={15} tintColor={mutedForeground} />
                </View>
              }
              endContent={
                query ? (
                  <Pressable
                    onPress={() => setQuery('')}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={t`Clear search`}
                    className="active:opacity-60"
                  >
                    <Icon name="xmark.circle.fill" size={17} tintColor={mutedForeground} />
                  </Pressable>
                ) : null
              }
            />
          </View>

          <BottomSheet.Body keyboardShouldPersistTaps="handled" contentContainerClassName="pb-6">
            {error ? (
              // The gateway's own words stay, muted, under a sentence that says
              // what it means here — a self-hoster debugging the endpoint needs
              // the detail, but it shouldn't be the headline.
              <View className="flex-row gap-2.5 py-3">
                <Icon name="exclamationmark.triangle.fill" size={15} tintColor={destructive} />
                <View className="flex-1 gap-1">
                  <Text size="sm" className="text-destructive">
                    {all.length > 0
                      ? t`Couldn't refresh the list — showing the last one.`
                      : t`Couldn't load the models.`}
                  </Text>
                  <Text size="xs" muted numberOfLines={3}>
                    {error}
                  </Text>
                </View>
              </View>
            ) : null}

            {groups.map(({ group, models: ids }) => (
              <View key={group} className="pt-4">
                <Text size="xs" muted className="pb-1 uppercase tracking-wider">
                  {group}
                </Text>
                {ids.map((id, index) => (
                  <Fragment key={id}>
                    {index > 0 ? <Item.Separator /> : null}
                    <PickerRow
                      label={modelLabel(id)}
                      selected={id === value}
                      checkColor={primary}
                      onPress={() => choose(id)}
                    />
                  </Fragment>
                ))}
              </View>
            ))}

            {/* An id the list doesn't have is still a valid answer — gateways
                route ids they don't advertise. Below the matches, so a search
                that hits doesn't open on a row nobody wanted. */}
            {isCustom ? (
              <View className={groups.length > 0 ? 'pt-4' : undefined}>
                <PickerRow
                  label={t`Use “${trimmed}”`}
                  icon={<Icon name="keyboard" size={15} tintColor={mutedForeground} />}
                  selected={false}
                  checkColor={primary}
                  onPress={() => choose(trimmed)}
                />
              </View>
            ) : null}

            {loading && all.length === 0 ? (
              <View className="items-center py-10">
                <ActivityIndicator color={mutedForeground} />
              </View>
            ) : null}

            {!loading && groups.length === 0 && !isCustom && !error ? (
              <Text size="sm" muted className="py-10 text-center">
                {all.length === 0
                  ? t`This endpoint listed no models. Type an id above.`
                  : t`No models match.`}
              </Text>
            ) : null}

            {visionOnly && (hiddenCount > 0 || showAll) ? (
              <Pressable
                onPress={() => setShowAll((prev) => !prev)}
                accessibilityRole="button"
                className="pt-5 active:opacity-60"
              >
                <Text size="sm" className="text-primary">
                  {showAll
                    ? t`Show only models that can read images`
                    : t`Show all models (${hiddenCount} hidden)`}
                </Text>
                {showAll ? null : (
                  <Text size="xs" muted className="pt-1">
                    {t`Hidden: text-only, speech and embedding models — guessed from their ids.`}
                  </Text>
                )}
              </Pressable>
            ) : null}

            <Animated.View style={keyboardSpacer} />
          </BottomSheet.Body>
        </BottomSheet.Content>
      </BottomSheet>
    </>
  );
}

function PickerRow({
  label,
  icon,
  selected,
  checkColor,
  onPress,
}: {
  label: string;
  icon?: React.ReactNode;
  selected: boolean;
  checkColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      className="min-h-[52px] flex-row items-center gap-3 active:opacity-60"
    >
      {icon}
      <Text className={cn('flex-1 text-[17px]', selected && 'font-semibold')} numberOfLines={1}>
        {label}
      </Text>
      {selected ? <Icon name="checkmark.circle.fill" size={22} tintColor={checkColor} /> : null}
    </Pressable>
  );
}
