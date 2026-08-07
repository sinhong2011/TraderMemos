import { ColorPicker } from '@expo/ui/swift-ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { queryKeys, useApiRequest, useTags } from '@/api/hooks';
import type { Tag } from '@/api/types';
import { FormField, FormFootnote, FormInput, FormSheet } from '@/components/form-sheet';
import { Segmented } from '@/components/segmented';
import { t } from '@lingui/core/macro';
import { errorMessage } from '@/lib/errors';
import { DEFAULT_TAG_COLOR, TAG_KINDS, TAG_SWATCHES } from '@/lib/tags';
import { AppHost } from '@/components/app-host';

/**
 * New / edit tag — the creation sheet the Tags list's + button opens, same
 * shape as new-token.tsx and cash-form.tsx. Color is a row of one-tap swatches
 * with the native picker at the end: picking a hue is a two-second decision,
 * so the system wheel shouldn't be the only way in.
 */
export default function NewTagScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApiRequest();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data: tags } = useTags();
  const editing = id ? tags?.find((tag) => tag.id === id) : undefined;

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
      inSheet
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
          autoFocus={!id}
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
        <View style={styles.swatches}>
          {TAG_SWATCHES.map((swatch) => (
            <Pressable
              key={swatch}
              onPress={() => setColor(swatch)}
              accessibilityRole="button"
              accessibilityLabel={swatch}
              accessibilityState={{ selected: color.toLowerCase() === swatch }}
              style={({ pressed }) => [
                styles.swatch,
                { backgroundColor: swatch },
                pressed && styles.pressed,
              ]}
            >
              {color.toLowerCase() === swatch ? (
                <SymbolView name="checkmark" size={14} tintColor="#FFFFFF" weight="bold" />
              ) : null}
            </Pressable>
          ))}
          {/* The system wheel keeps every other hex reachable — it sits in the
              row as one more swatch rather than owning its own labelled line. */}
          <AppHost style={styles.picker}>
            <ColorPicker selection={color} onSelectionChange={setColor} supportsOpacity={false} />
          </AppHost>
        </View>
      </FormField>
    </FormSheet>
  );
}

const styles = StyleSheet.create((theme) => ({
  swatches: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing.sm },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  picker: { width: 34, height: 34 },
  pressed: { opacity: 0.7 },
}));
