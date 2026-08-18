import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ColorPicker } from 'panelui-native';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { Icon } from '@/components/icon';
import { queryKeys, useApiRequest, useTags } from '@/api/hooks';
import type { Tag } from '@/api/types';
import { FormField, FormFootnote, FormInput, FormSheet } from '@/components/form-sheet';
import { Segmented } from '@/components/segmented';
import { t } from '@lingui/core/macro';
import { errorMessage } from '@/lib/errors';
import { DEFAULT_TAG_COLOR, TAG_KINDS, TAG_SWATCHES } from '@/lib/tags';

/** Preset swatch and custom-picker trigger share one 34pt round footprint. */
const SWATCH = 'h-[34px] w-[34px] items-center justify-center rounded-full';

/**
 * New / edit tag — the creation sheet the Tags list's + button opens, same
 * shape as new-token.tsx and cash-form.tsx. Color is a row of one-tap swatches
 * with a full picker at the end: picking a hue is a two-second decision, so
 * the saturation area shouldn't be the only way in.
 */
export default function NewTagScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApiRequest();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data: tags } = useTags();
  const editing = id ? tags?.find((tag) => tag.id === id) : undefined;
  const [mutedForeground] = useCSSVariable(['--color-muted-foreground']) as [string];

  const [name, setName] = useState(editing?.name ?? '');
  const [kind, setKind] = useState(editing?.kind ?? 'custom');
  const [color, setColor] = useState(editing?.color || DEFAULT_TAG_COLOR);

  const save = useMutation({
    mutationFn: (body: { name: string; color: string; kind: string; description: string }) =>
      // The API routes updates as PATCH but replaces every field — send it whole.
      id
        ? api<Tag>(`/tags/${id}`, { method: 'PATCH', body })
        : api<Tag>('/tags', { method: 'POST', body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tags() });
      router.back();
    },
    onError: (err) =>
      Alert.alert(id ? t`Could not save tag` : t`Could not create tag`, errorMessage(err)),
  });

  const trimmedName = name.trim();

  function handleSave() {
    if (!trimmedName) return;
    save.mutate({
      name: trimmedName,
      color,
      kind,
      description: editing?.description ?? '',
    });
  }

  return (
    <FormSheet
      pushed
      title={id ? t`Edit tag` : t`New tag`}
      saving={save.isPending}
      // Nothing to save without a name — grey the action instead of letting
      // the tap raise an alert.
      saveDisabled={!trimmedName}
      onSave={handleSave}
    >
      <FormFootnote>{t`Annotate trades with mistakes, habits, and custom labels.`}</FormFootnote>
      <FormField quiet label={t`Name`}>
        <FormInput
          value={name}
          onChangeText={setName}
          placeholder={t`e.g. FOMO`}
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={handleSave}
        />
      </FormField>
      <FormField quiet label={t`Kind`}>
        <Segmented
          fill
          options={TAG_KINDS.map((option) => ({ value: option.value, label: option.label() }))}
          value={kind}
          onChange={setKind}
        />
      </FormField>
      <FormField quiet label={t`Color`}>
        <View className="flex-row flex-wrap items-center gap-2">
          {TAG_SWATCHES.map((swatch) => (
            <Pressable
              key={swatch}
              onPress={() => setColor(swatch)}
              accessibilityRole="button"
              accessibilityLabel={swatch}
              accessibilityState={{ selected: color.toLowerCase() === swatch }}
              className={`${SWATCH} active:opacity-70`}
              // The hue is the datum — it comes from the tag, not the theme.
              style={{ backgroundColor: swatch }}
            >
              {color.toLowerCase() === swatch ? (
                <Icon name="checkmark" size={14} tintColor="#FFFFFF" weight="bold" />
              ) : null}
            </Pressable>
          ))}
          {/* The full picker keeps every other hex reachable — it sits in the
              row as one more swatch rather than owning its own labelled line.
              `onValueCommit` rather than `onValueChange`: the drag reports on
              every frame, and only the colour you let go of is a choice. */}
          <ColorPicker
            value={color}
            onValueCommit={setColor}
            format="hex"
            presentation="popover"
          >
            <ColorPicker.Trigger>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t`Custom color`}
                className={`${SWATCH} border border-input bg-muted active:opacity-70`}
              >
                <Icon name="plus" size={14} tintColor={mutedForeground} weight="semibold" />
              </Pressable>
            </ColorPicker.Trigger>
            <ColorPicker.Content>
              <ColorPicker.Area height={140} />
              <ColorPicker.Hue />
              <ColorPicker.Preview showValue />
            </ColorPicker.Content>
          </ColorPicker>
        </View>
      </FormField>
    </FormSheet>
  );
}
