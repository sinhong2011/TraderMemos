import { DatePicker, Host } from '@expo/ui/swift-ui';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { NoteSymbol, NoteType } from '@/api/types';
import { FormField, FormInput } from '@/components/form-sheet';
import { Segmented } from '@/components/segmented';
import { t } from '@lingui/core/macro';

export type NoteFormValues = {
  type: NoteType;
  /** YYYY-MM-DD — the API stores occurred_at as an opaque date string. */
  occurredAt: string;
  title: string;
  body: string;
  symbols: NoteSymbol[];
};

export function emptyNoteValues(): NoteFormValues {
  const now = new Date();
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return { type: 'note', occurredAt: day, title: '', body: '', symbols: [] };
}

/**
 * Shared note editor body — type switch, date, title, markdown body, and (for
 * daily logs) repeatable per-symbol blocks. New-note and edit-note wrap it in
 * their own FormSheet so create/save/delete stay with the route.
 */
export function NoteFormFields({
  values,
  onChange,
}: {
  values: NoteFormValues;
  onChange: (patch: Partial<NoteFormValues>) => void;
}) {
  const { theme } = useUnistyles();
  // Local text state for the "add symbol" field.
  const [newSymbol, setNewSymbol] = useState('');

  const types = [
    { value: 'note' as const, label: t`Note` },
    { value: 'daily_log' as const, label: t`Daily log` },
  ];

  function addSymbol() {
    const ticker = newSymbol.trim().toUpperCase();
    if (!ticker) return;
    if (values.symbols.some((s) => s.symbol === ticker)) {
      setNewSymbol('');
      return;
    }
    onChange({ symbols: [...values.symbols, { symbol: ticker, body: '' }] });
    setNewSymbol('');
  }

  return (
    <>
      <FormField label={t`Type`}>
        <Segmented options={types} value={values.type} onChange={(type) => onChange({ type })} />
      </FormField>

      <FormField label={t`Date`}>
        <Host matchContents ignoreSafeArea="all">
          <DatePicker
            selection={new Date(`${values.occurredAt}T12:00:00`)}
            displayedComponents={['date']}
            onDateChange={(date) => {
              const d = new Date(date);
              onChange({
                occurredAt: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
              });
            }}
          />
        </Host>
      </FormField>

      <FormField label={t`Title`}>
        <FormInput
          value={values.title}
          onChangeText={(title) => onChange({ title })}
          placeholder={values.type === 'daily_log' ? t`Daily log` : t`Optional title`}
        />
      </FormField>

      <FormField label={values.type === 'daily_log' ? t`Session recap` : t`Note`}>
        <FormInput
          value={values.body}
          onChangeText={(body) => onChange({ body })}
          placeholder={
            values.type === 'daily_log'
              ? t`How did the session go? Use "- [ ]" for checklist items.`
              : t`What happened today?`
          }
          multiline
        />
      </FormField>

      {values.type === 'daily_log' ? (
        <FormField label={t`Symbols`}>
          <View style={styles.symbolAdd}>
            <View style={styles.symbolInput}>
              <FormInput
                value={newSymbol}
                onChangeText={setNewSymbol}
                placeholder={t`Add symbol, e.g. AAPL`}
                autoCapitalize="characters"
                autoCorrect={false}
                onSubmitEditing={addSymbol}
                returnKeyType="done"
              />
            </View>
            <Pressable
              onPress={addSymbol}
              accessibilityRole="button"
              accessibilityLabel={t`Add symbol`}
              style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
            >
              <SymbolView name="plus" size={16} tintColor={theme.colors.foreground} />
            </Pressable>
          </View>

          {values.symbols.map((symbol, index) => (
            <View key={symbol.symbol} style={styles.symbolBlock}>
              <View style={styles.symbolHead}>
                <Text style={styles.symbolName}>{symbol.symbol}</Text>
                <Pressable
                  onPress={() =>
                    onChange({ symbols: values.symbols.filter((_, i) => i !== index) })
                  }
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t`Remove ${symbol.symbol}`}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <SymbolView name="xmark" size={13} tintColor={theme.colors.mutedForeground} />
                </Pressable>
              </View>
              <FormInput
                value={symbol.body}
                onChangeText={(body) =>
                  onChange({
                    symbols: values.symbols.map((s, i) => (i === index ? { ...s, body } : s)),
                  })
                }
                placeholder={t`What did ${symbol.symbol} do?`}
                multiline
              />
            </View>
          ))}
        </FormField>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
  symbolAdd: { flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' },
  symbolInput: { flex: 1 },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.muted,
  },
  pressed: { opacity: 0.6 },
  symbolBlock: { gap: theme.spacing.xs, marginTop: theme.spacing.sm },
  symbolHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  symbolName: { fontSize: 14, fontWeight: '600', color: theme.colors.foreground },
}));
