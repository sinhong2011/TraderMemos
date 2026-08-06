import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SymbolView } from 'expo-symbols';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Keyboard, Pressable, Text, TextInput, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { queryKeys, useApiRequest, useSetups } from '@/api/hooks';
import type { Setup } from '@/api/types';
import {
  Card,
  ControlRow,
  InputRow,
  SectionFooter,
  SectionHeader,
} from '@/components/form-rows';
import { FormSheet } from '@/components/form-sheet';
import { ValueToggle } from '@/components/value-toggle';
import { PnlFill } from '@/styles/unistyles';
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

/** A checklist line being edited — the id is local, so rows can be reordered
 *  and focused without React reusing the wrong input for a new line. */
type Check = { id: string; text: string };

let checkSeq = 0;
function newCheck(text = ''): Check {
  checkSeq += 1;
  return { id: `c${checkSeq}`, text };
}

/** Tolerates a pasted `- [ ] foo` — the shape the web editor's markdown uses. */
function cleanCheck(text: string): string {
  return text.replace(/^\s*-\s*(\[[ xX]\]\s*)?/, '').trim();
}

/**
 * Playbook setup editor — create, or edit/delete when an `id` param is
 * present (pushed from the Playbook screen). Posts real /setups entities,
 * matching the web drawer; the trade form links trades to these.
 *
 * A setup is something you write, not something you fill in, so the screen
 * opens as the note editor does: the name is the headline and the thesis is the
 * prose under it, both borderless on the page (see note-form.tsx — a bordered
 * shell around 168pt of writing is what made this feel like a form). Only the
 * things that really are fields — bias, symbol, the two prices — keep the
 * grouped-row treatment every other creation sheet uses.
 *
 * The checklist is rows, not a textarea: one line per check, added and removed
 * in place. That is the same call the daily-checklist editor made — nobody
 * should be hand-typing list punctuation into a paragraph box — and a list
 * typed as prose can't show what it is: a run of things to clear.
 */
export default function NewSetupScreen() {
  const router = useRouter();
  const { theme } = useUnistyles();
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
  const [checks, setChecks] = useState<Check[]>(() =>
    (editing?.checklist ?? []).map((item) => newCheck(item)),
  );
  /** Row that should open with the caret in it — the one just added. */
  const [focusId, setFocusId] = useState<string | null>(null);

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

  function addCheck(afterIndex?: number) {
    const check = newCheck();
    setChecks((previous) => {
      const next = [...previous];
      next.splice(afterIndex == null ? next.length : afterIndex + 1, 0, check);
      return next;
    });
    setFocusId(check.id);
  }

  function handleSave() {
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
      checklist: checks.map((check) => cleanCheck(check.text)).filter(Boolean),
    });
  }

  function confirmDelete() {
    Alert.alert(t`Delete setup?`, t`Trades keep their journal — only the playbook entry goes.`, [
      { text: t`Cancel`, style: 'cancel' },
      { text: t`Delete`, style: 'destructive', onPress: () => remove.mutate() },
    ]);
  }

  const biases = [
    { value: 'long' as const, label: t`Long`, fill: PnlFill.pos },
    { value: 'short' as const, label: t`Short`, fill: PnlFill.neg },
  ] as const;

  return (
    <FormSheet
      title={editing ? t`Edit setup` : t`New setup`}
      saving={save.isPending}
      // A play with no name can't be saved, and greying the commit says so
      // without spending an alert on it (the cash form's rule).
      saveDisabled={!name.trim()}
      onSave={handleSave}
    >
      {/*
        The writing block owns the page, not a card: no shell, no captions —
        the header above already names the screen. Unstyled, so it keeps the
        scroll area's page margin and outdents from the grouped rows the way a
        large title does in Settings; the wrapper is only here to hold the two
        fields together against the column's gap.
      */}
      <View>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t`Breakout pullback`}
          placeholderTextColor={theme.colors.mutedForeground}
          style={styles.headline}
          autoCorrect={false}
          autoFocus={!editing}
        />
        <TextInput
          value={thesis}
          onChangeText={setThesis}
          placeholder={t`What has to be happening for this play to be on? Where is it wrong?`}
          placeholderTextColor={theme.colors.mutedForeground}
          style={styles.thesis}
          multiline
        />
      </View>

      <SectionHeader label={t`Plan`} />
      <Card>
        <ControlRow label={t`Bias`}>
          <ValueToggle options={biases} value={direction} onChange={setDirection} />
        </ControlRow>
        <InputRow
          label={t`Symbol`}
          value={symbol}
          onChangeText={setSymbol}
          placeholder={t`Any`}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <InputRow
          label={t`Target`}
          value={target}
          onChangeText={setTarget}
          placeholder="0.00"
          numeric
        />
        <InputRow label={t`Stop`} value={stop} onChangeText={setStop} placeholder="0.00" numeric />
      </Card>
      <SectionFooter
        label={t`A symbol pins the play to one ticker — leave it on Any for a pattern you trade anywhere.`}
      />

      <SectionHeader label={t`Checklist`} />
      <Card>
        {checks.map((check, index) => (
          <View key={check.id} style={styles.checkRow}>
            <SymbolView name="circle" size={17} tintColor={theme.colors.mutedForeground} />
            <TextInput
              value={check.text}
              onChangeText={(text) =>
                setChecks((previous) =>
                  previous.map((row) => (row.id === check.id ? { ...row, text } : row)),
                )
              }
              placeholder={t`One thing that has to be true`}
              placeholderTextColor={theme.colors.mutedForeground}
              style={styles.checkInput}
              autoFocus={check.id === focusId}
              returnKeyType="next"
              // Return opens the next line instead of closing the keyboard —
              // a list is written in one pass, and a row that dismissed it
              // would make every check a two-tap affair.
              submitBehavior="submit"
              onSubmitEditing={() =>
                check.text.trim() ? addCheck(index) : Keyboard.dismiss()
              }
            />
            <Pressable
              onPress={() => setChecks((previous) => previous.filter((row) => row.id !== check.id))}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t`Remove check`}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <SymbolView name="minus.circle" size={19} tintColor={theme.colors.mutedForeground} />
            </Pressable>
          </View>
        ))}
        <Pressable
          onPress={() => addCheck()}
          accessibilityRole="button"
          style={({ pressed }) => [styles.checkRow, pressed && styles.pressed]}
        >
          <SymbolView name="plus.circle.fill" size={17} tintColor={theme.colors.primary} />
          <Text style={styles.addLabel}>{checks.length === 0 ? t`Add a check` : t`Add another`}</Text>
        </Pressable>
      </Card>
      <SectionFooter label={t`Everything that has to be true before you take the play.`} />

      {editing ? (
        <Card>
          <Pressable
            onPress={confirmDelete}
            disabled={remove.isPending}
            accessibilityRole="button"
            style={({ pressed }) => [styles.deleteRow, pressed && styles.pressed]}
          >
            <Text style={styles.deleteLabel}>
              {remove.isPending ? t`Deleting…` : t`Delete setup`}
            </Text>
          </Pressable>
        </Card>
      ) : null}
    </FormSheet>
  );
}

const styles = StyleSheet.create((theme) => ({
  headline: {
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 28,
    paddingVertical: theme.spacing.sm,
    color: theme.colors.foreground,
  },
  // `minHeight`, never `flex` — a multiline input with no bound inside the
  // form's scroll view reports an effectively infinite height (form-sheet.tsx).
  thesis: {
    minHeight: 72,
    fontSize: 17,
    lineHeight: 24,
    paddingTop: theme.spacing.xs,
    textAlignVertical: 'top',
    color: theme.colors.foreground,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    minHeight: 48,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xs,
  },
  checkInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: theme.spacing.sm,
    color: theme.colors.foreground,
  },
  addLabel: { fontSize: 16, color: theme.colors.primary },
  deleteRow: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  deleteLabel: { fontSize: 16, color: theme.colors.destructive },
  pressed: { opacity: 0.6 },
}));
