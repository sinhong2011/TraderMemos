import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { queryKeys, useApiRequest, useSetups } from '@/api/hooks';
import type { Setup } from '@/api/types';
import { FormField, FormInput, FormSheet } from '@/components/form-sheet';
import { Segmented } from '@/components/segmented';
import { t } from '@lingui/core/macro';
import { parseAmount } from '@/lib/amount';

type Direction = 'long' | 'short';

/** POST/PATCH body for /setups (web SetupBody). */
type SetupBody = {
  name: string;
  thesis?: string;
  symbol?: string;
  direction?: string;
  target_price?: number | null;
  stop_price?: number | null;
  checklist?: string[];
};

/**
 * Playbook setup editor — create, or edit/delete when an `id` param is
 * present (pushed from the Playbook screen). Posts real /setups entities,
 * matching the web drawer; the trade form links trades to these.
 */
export default function NewSetupScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApiRequest();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const setups = useSetups();
  const editing: Setup | undefined = id
    ? setups.data?.find((setup) => setup.id === id)
    : undefined;

  const [name, setName] = useState(() => editing?.name ?? '');
  const [thesis, setThesis] = useState(() => editing?.thesis || editing?.description || '');
  const [symbol, setSymbol] = useState(() => editing?.symbol ?? '');
  const [direction, setDirection] = useState<Direction>(() =>
    editing?.direction === 'short' ? 'short' : 'long',
  );
  const [target, setTarget] = useState(() =>
    editing?.target_price != null ? String(editing.target_price) : '',
  );
  const [stop, setStop] = useState(() =>
    editing?.stop_price != null ? String(editing.stop_price) : '',
  );
  const [checklistText, setChecklistText] = useState(() =>
    (editing?.checklist ?? []).join('\n'),
  );

  const save = useMutation({
    mutationFn: (body: SetupBody) =>
      editing
        ? api(`/setups/${editing.id}`, { method: 'PATCH', body })
        : api('/setups', { method: 'POST', body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.setups() });
      router.back();
    },
    onError: (err) => Alert.alert(t`Could not save`, err.message),
  });

  const remove = useMutation({
    mutationFn: () => api<void>(`/setups/${editing!.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.setups() });
      router.back();
    },
    onError: (err) => Alert.alert(t`Could not delete`, err.message),
  });

  function handleSave() {
    if (!name.trim()) {
      Alert.alert(t`Could not save`, t`Enter a setup name.`);
      return;
    }
    const targetPrice = parseAmount(target);
    const stopPrice = parseAmount(stop);
    if (targetPrice === undefined || stopPrice === undefined) {
      Alert.alert(t`Could not save`, t`Enter valid prices.`);
      return;
    }
    save.mutate({
      name: name.trim(),
      thesis: thesis.trim(),
      symbol: symbol.trim().toUpperCase(),
      direction,
      target_price: targetPrice,
      stop_price: stopPrice,
      checklist: checklistText
        .split('\n')
        .map((line) => line.replace(/^\s*-\s*(\[[ xX]\]\s*)?/, '').trim())
        .filter(Boolean),
    });
  }

  function confirmDelete() {
    Alert.alert(t`Delete setup?`, t`Trades keep their journal — only the playbook entry goes.`, [
      { text: t`Cancel`, style: 'cancel' },
      { text: t`Delete`, style: 'destructive', onPress: () => remove.mutate() },
    ]);
  }

  const directions = [
    { value: 'long' as const, label: t`Long` },
    { value: 'short' as const, label: t`Short` },
  ];

  return (
    <FormSheet
      title={editing ? t`Edit setup` : t`New setup`}
      saving={save.isPending}
      onSave={handleSave}
    >
      <FormField label={t`Name`}>
        <FormInput
          value={name}
          onChangeText={setName}
          placeholder={t`Breakout pullback`}
          autoCorrect={false}
        />
      </FormField>
      <FormField label={t`Thesis`}>
        <FormInput
          value={thesis}
          onChangeText={setThesis}
          placeholder={t`Entry criteria, invalidation, targets…`}
          multiline
        />
      </FormField>
      <FormField label={t`Bias`}>
        <Segmented options={directions} value={direction} onChange={setDirection} />
      </FormField>
      <FormField label={t`Symbol`}>
        <FormInput
          value={symbol}
          onChangeText={setSymbol}
          placeholder={t`Optional — e.g. AAPL`}
          autoCapitalize="characters"
          autoCorrect={false}
        />
      </FormField>
      <View style={styles.priceRow}>
        <View style={styles.priceField}>
          <FormField label={t`Target`}>
            <FormInput
              value={target}
              onChangeText={setTarget}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
          </FormField>
        </View>
        <View style={styles.priceField}>
          <FormField label={t`Stop`}>
            <FormInput
              value={stop}
              onChangeText={setStop}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
          </FormField>
        </View>
      </View>
      <FormField label={t`Checklist`}>
        <FormInput
          value={checklistText}
          onChangeText={setChecklistText}
          placeholder={t`One check per line`}
          multiline
          autoCorrect={false}
        />
      </FormField>

      {editing ? (
        <View style={styles.dangerZone}>
          <Pressable
            onPress={confirmDelete}
            disabled={remove.isPending}
            accessibilityRole="button"
            style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
          >
            <Text style={styles.deleteLabel}>
              {remove.isPending ? t`Deleting…` : t`Delete setup`}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </FormSheet>
  );
}

const styles = StyleSheet.create((theme) => ({
  priceRow: { flexDirection: 'row', gap: theme.spacing.md },
  priceField: { flex: 1 },
  dangerZone: { paddingTop: theme.spacing.xl, alignItems: 'center' },
  deleteButton: { paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.lg },
  pressed: { opacity: 0.6 },
  deleteLabel: { fontSize: 15, fontWeight: '500', color: theme.colors.destructive },
}));
