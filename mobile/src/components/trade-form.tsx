import { DatePicker, Host } from '@expo/ui/swift-ui';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { Account, Setup, Tag } from '@/api/types';
import { ChipGroup } from '@/components/chips';
import { FormField, FormInput, FormSheet } from '@/components/form-sheet';
import { Segmented } from '@/components/segmented';
import { t } from '@lingui/core/macro';
import {
  EMOTIONAL_STATES,
  FUTURES_PRESETS,
  TRADE_GRADES,
  TRADE_SESSIONS,
  futuresMultiplierForSymbol,
} from '@/lib/journal';
import {
  emptyFill,
  type FillDraft,
  type Market,
  type TradeFormValues,
} from '@/lib/trade-form';

/** Muted uppercase divider between form sections (Instrument / Fills / Journal…). */
function SectionHeader({ label }: { label: string }) {
  return <Text style={styles.section}>{label}</Text>;
}

/** Single-select chip row: tapping the active chip clears it. */
function SingleChips({
  options,
  value,
  onChange,
  tone,
}: {
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  tone?: 'accent' | 'neg';
}) {
  return (
    <ChipGroup
      options={options}
      selected={value ? [value] : []}
      onToggle={(v) => onChange(v === value ? '' : v)}
      tone={tone}
    />
  );
}

function toggleIn(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function FillCard({
  fill,
  index,
  removable,
  onChange,
  onRemove,
}: {
  fill: FillDraft;
  index: number;
  removable: boolean;
  onChange: (patch: Partial<FillDraft>) => void;
  onRemove: () => void;
}) {
  const { theme } = useUnistyles();
  const sides = [
    { value: 'buy' as const, label: t`Buy` },
    { value: 'sell' as const, label: t`Sell` },
  ];

  return (
    <View style={styles.fillCard}>
      <View style={styles.fillHeader}>
        <Text style={styles.fillTitle}>{t`Fill ${index + 1}`}</Text>
        {removable ? (
          <Pressable
            onPress={onRemove}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t`Remove fill`}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <SymbolView name="trash" size={15} tintColor={theme.colors.loss} />
          </Pressable>
        ) : null}
      </View>
      <Segmented options={sides} value={fill.side} onChange={(side) => onChange({ side })} />
      <Host matchContents>
        <DatePicker
          title={t`Executed at`}
          selection={fill.executedAt}
          displayedComponents={['date', 'hourAndMinute']}
          onDateChange={(executedAt) => onChange({ executedAt })}
        />
      </Host>
      <View style={styles.inputRow}>
        <View style={styles.flex}>
          <FormField label={t`Quantity`}>
            <FormInput
              value={fill.quantity}
              onChangeText={(quantity) => onChange({ quantity })}
              placeholder="100"
              keyboardType="decimal-pad"
            />
          </FormField>
        </View>
        <View style={styles.flex}>
          <FormField label={t`Price`}>
            <FormInput
              value={fill.price}
              onChangeText={(price) => onChange({ price })}
              placeholder="10.50"
              keyboardType="decimal-pad"
            />
          </FormField>
        </View>
      </View>
      <View style={styles.inputRow}>
        <View style={styles.flex}>
          <FormField label={t`Fees`}>
            <FormInput
              value={fill.fees}
              onChangeText={(fees) => onChange({ fees })}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
          </FormField>
        </View>
        <View style={styles.flex}>
          <FormField label={t`Commission`}>
            <FormInput
              value={fill.commission}
              onChangeText={(commission) => onChange({ commission })}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
          </FormField>
        </View>
      </View>
    </View>
  );
}

/**
 * Full trade entry/edit form, field-parity with the web NewTradeDrawer's single
 * symbol block: instrument (5 markets, option contract, futures multiplier),
 * multiple fills, plan, journal taxonomy, and dividend. Screens own submission.
 */
export function TradeForm({
  title,
  initial,
  accounts,
  setups,
  tags,
  saving,
  lockInstrument = false,
  onSave,
}: {
  title: string;
  initial: TradeFormValues;
  accounts: Account[];
  setups: Setup[];
  tags: Tag[];
  saving: boolean;
  /** Editing: market/symbol/option/multiplier are not patchable server-side, so lock them. */
  lockInstrument?: boolean;
  onSave: (values: TradeFormValues) => void;
}) {
  const [values, setValues] = useState<TradeFormValues>(initial);
  const set = <K extends keyof TradeFormValues>(key: K, value: TradeFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const customTags = tags.filter((tag) => tag.kind !== 'mistake');
  const mistakeTags = tags.filter((tag) => tag.kind === 'mistake');
  const isNew = !lockInstrument;

  const markets: { value: Market; label: string }[] = [
    { value: 'stock', label: t`Stock` },
    { value: 'option', label: t`Option` },
    { value: 'crypto', label: t`Crypto` },
    { value: 'future', label: t`Futures` },
    { value: 'forex', label: t`Forex` },
  ];
  const directions = [
    { value: 'long' as const, label: t`Long` },
    { value: 'short' as const, label: t`Short` },
  ];
  const grades = TRADE_GRADES.map((g) => ({ value: g, label: g }));

  function onSymbolChange(symbol: string) {
    setValues((v) => {
      const next = { ...v, symbol };
      // Typing a known futures root fills its point value, like the web presets.
      if (v.market === 'future' && !v.multiplier.trim()) {
        const preset = futuresMultiplierForSymbol(symbol);
        if (preset != null) next.multiplier = String(preset);
      }
      return next;
    });
  }

  function updateFill(key: string, patch: Partial<FillDraft>) {
    setValues((v) => ({
      ...v,
      fills: v.fills.map((fill) => (fill.key === key ? { ...fill, ...patch } : fill)),
    }));
  }

  return (
    <FormSheet title={title} saving={saving} onSave={() => onSave(values)}>
      {accounts.length > 1 ? (
        <FormField label={t`Account`}>
          <SingleChips
            options={accounts.map((a) => ({ value: a.id, label: a.name }))}
            value={values.accountId}
            onChange={(accountId) => set('accountId', accountId || values.accountId)}
          />
        </FormField>
      ) : null}

      {isNew ? (
        <>
          <FormField label={t`Market`}>
            <SingleChips
              options={markets}
              value={values.market}
              onChange={(m) => set('market', (m || 'stock') as Market)}
            />
          </FormField>
          <FormField label={t`Symbol`}>
            <FormInput
              value={values.symbol}
              onChangeText={onSymbolChange}
              placeholder="AAPL"
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </FormField>
          <FormField label={t`Direction`}>
            <Segmented
              options={directions}
              value={values.direction}
              onChange={(direction) => set('direction', direction)}
            />
          </FormField>

          {values.market === 'option' ? (
            <>
              <FormField label={t`Contract`}>
                <SingleChips
                  options={[
                    { value: 'call', label: t`Call` },
                    { value: 'put', label: t`Put` },
                  ]}
                  value={values.optionRight}
                  onChange={(right) => set('optionRight', right as '' | 'call' | 'put')}
                />
              </FormField>
              <View style={styles.inputRow}>
                <View style={styles.flex}>
                  <FormField label={t`Strike`}>
                    <FormInput
                      value={values.optionStrike}
                      onChangeText={(optionStrike) => set('optionStrike', optionStrike)}
                      placeholder="705"
                      keyboardType="decimal-pad"
                    />
                  </FormField>
                </View>
                <View style={styles.flex}>
                  <FormField label={t`Expiry`}>
                    <FormInput
                      value={values.optionExpiry}
                      onChangeText={(optionExpiry) => set('optionExpiry', optionExpiry)}
                      placeholder="2026-09-18"
                      autoCorrect={false}
                    />
                  </FormField>
                </View>
              </View>
            </>
          ) : null}

          {values.market === 'future' ? (
            <FormField label={t`Point value`}>
              <SingleChips
                options={FUTURES_PRESETS.map((p) => ({
                  value: String(p.multiplier),
                  label: p.label,
                }))}
                value={values.multiplier}
                onChange={(multiplier) => set('multiplier', multiplier)}
              />
              <FormInput
                value={values.multiplier}
                onChangeText={(multiplier) => set('multiplier', multiplier)}
                placeholder={t`Multiplier`}
                keyboardType="decimal-pad"
              />
            </FormField>
          ) : null}
        </>
      ) : (
        <FormField label={t`Symbol`}>
          <Text style={styles.lockedSymbol}>{values.symbol}</Text>
        </FormField>
      )}

      <SectionHeader label={t`Fills`} />
      {values.fills.map((fill, index) => (
        <FillCard
          key={fill.key}
          fill={fill}
          index={index}
          removable={values.fills.length > 1}
          onChange={(patch) => updateFill(fill.key, patch)}
          onRemove={() =>
            setValues((v) => ({ ...v, fills: v.fills.filter((f) => f.key !== fill.key) }))
          }
        />
      ))}
      <Pressable
        onPress={() =>
          setValues((v) => ({
            ...v,
            fills: [...v.fills, emptyFill(v.direction === 'long' ? 'sell' : 'buy')],
          }))
        }
        accessibilityRole="button"
        style={({ pressed }) => [styles.addFill, pressed && styles.pressed]}
      >
        <Text style={styles.addFillLabel}>{t`Add fill`}</Text>
      </Pressable>

      <SectionHeader label={t`Plan`} />
      <View style={styles.inputRow}>
        <View style={styles.flex}>
          <FormField label={t`Target`}>
            <FormInput
              value={values.target}
              onChangeText={(target) => set('target', target)}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
          </FormField>
        </View>
        <View style={styles.flex}>
          <FormField label={t`Stop`}>
            <FormInput
              value={values.stop}
              onChangeText={(stop) => set('stop', stop)}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
          </FormField>
        </View>
      </View>

      <SectionHeader label={t`Journal`} />
      {setups.length > 0 ? (
        <FormField label={t`Setups`}>
          <ChipGroup
            options={setups.map((s) => ({ value: s.id, label: s.name }))}
            selected={values.setupIds}
            onToggle={(id) => set('setupIds', toggleIn(values.setupIds, id))}
          />
        </FormField>
      ) : null}
      <FormField label={t`Session`}>
        <SingleChips
          options={TRADE_SESSIONS.map((s) => ({ value: s, label: s }))}
          value={values.session}
          onChange={(session) => set('session', session)}
        />
      </FormField>
      <FormField label={t`Emotion`}>
        <ChipGroup
          options={EMOTIONAL_STATES.map((s) => ({ value: s, label: s }))}
          selected={values.emotions}
          onToggle={(s) => set('emotions', toggleIn(values.emotions, s))}
        />
      </FormField>
      <FormField label={t`Setup rating`}>
        <SingleChips
          options={grades}
          value={values.setupGrade}
          onChange={(setupGrade) => set('setupGrade', setupGrade)}
        />
      </FormField>
      <FormField label={t`Execution rating`}>
        <SingleChips
          options={grades}
          value={values.executionGrade}
          onChange={(executionGrade) => set('executionGrade', executionGrade)}
        />
      </FormField>
      {customTags.length > 0 ? (
        <FormField label={t`Tags`}>
          <ChipGroup
            options={customTags.map((tag) => ({ value: tag.id, label: tag.name }))}
            selected={values.tagIds}
            onToggle={(id) => set('tagIds', toggleIn(values.tagIds, id))}
          />
        </FormField>
      ) : null}
      {mistakeTags.length > 0 ? (
        <FormField label={t`Mistake type`}>
          <ChipGroup
            options={mistakeTags.map((tag) => ({ value: tag.id, label: tag.name }))}
            selected={values.mistakeIds}
            onToggle={(id) => set('mistakeIds', toggleIn(values.mistakeIds, id))}
            tone="neg"
          />
        </FormField>
      ) : null}
      <FormField label={t`Entry reason`}>
        <FormInput
          value={values.entryReason}
          onChangeText={(entryReason) => set('entryReason', entryReason)}
          placeholder={t`Why did you enter?`}
          multiline
        />
      </FormField>
      <FormField label={t`Exit reason`}>
        <FormInput
          value={values.exitReason}
          onChangeText={(exitReason) => set('exitReason', exitReason)}
          placeholder={t`Why did you exit?`}
          multiline
        />
      </FormField>
      <FormField label={t`Review notes`}>
        <FormInput
          value={values.reviewNotes}
          onChangeText={(reviewNotes) => set('reviewNotes', reviewNotes)}
          placeholder={t`What would you do differently?`}
          multiline
        />
      </FormField>

      <SectionHeader label={t`Dividend`} />
      <View style={styles.inputRow}>
        <View style={styles.flex}>
          <FormField label={t`Amount`}>
            <FormInput
              value={values.dividendAmount}
              onChangeText={(dividendAmount) => set('dividendAmount', dividendAmount)}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
          </FormField>
        </View>
        <View style={styles.flex}>
          <FormField label={t`Date`}>
            <Host matchContents>
              <DatePicker
                selection={values.dividendDate}
                displayedComponents={['date']}
                onDateChange={(dividendDate) => set('dividendDate', dividendDate)}
              />
            </Host>
          </FormField>
        </View>
      </View>
      <FormField label={t`Note`}>
        <FormInput
          value={values.dividendNote}
          onChangeText={(dividendNote) => set('dividendNote', dividendNote)}
          placeholder={t`Optional`}
        />
      </FormField>
    </FormSheet>
  );
}

const styles = StyleSheet.create((theme) => ({
  flex: { flex: 1 },
  inputRow: { flexDirection: 'row', gap: theme.spacing.md },
  section: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: theme.colors.mutedForeground,
    marginTop: theme.spacing.sm,
  },
  fillCard: {
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.card,
  },
  fillHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fillTitle: { fontSize: 13, fontWeight: '600', color: theme.colors.mutedForeground },
  addFill: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.muted,
  },
  addFillLabel: { fontSize: 15, fontWeight: '600', color: theme.colors.foreground },
  lockedSymbol: { fontSize: 17, fontWeight: '700', color: theme.colors.foreground },
  pressed: { opacity: 0.6 },
}));
