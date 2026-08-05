import { SymbolView } from 'expo-symbols';
import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { Account, Setup, Tag } from '@/api/types';
import { ChipGroup } from '@/components/chips';
import {
  Card,
  ControlRow,
  DateRow,
  InputRow,
  NotesRow,
  SectionFooter,
  SectionHeader,
  StackRow,
} from '@/components/form-rows';
import { FormScrollArea, FormSheet } from '@/components/form-sheet';
import { ScreenshotQueue } from '@/components/screenshot-queue';
import { GlassButton } from '@/components/glass-button';
import { Segmented } from '@/components/segmented';
import { SymbolPager } from '@/components/symbol-pager';
import { TradePrefillBar } from '@/components/trade-prefill-bar';
import { ValueToggle } from '@/components/value-toggle';
import { PnlFill } from '@/styles/unistyles';
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
  emptyTradeForm,
  type FillDraft,
  type Market,
  type TradeFormValues,
} from '@/lib/trade-form';

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
      select="single"
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
    { value: 'buy' as const, label: t`Buy`, fill: PnlFill.pos },
    { value: 'sell' as const, label: t`Sell`, fill: PnlFill.neg },
  ] as const;

  return (
    <Card>
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
      <ControlRow label={t`Side`}>
        <ValueToggle options={sides} value={fill.side} onChange={(side) => onChange({ side })} />
      </ControlRow>
      <DateRow
        label={t`Executed at`}
        selection={fill.executedAt}
        displayedComponents={['date', 'hourAndMinute']}
        onDateChange={(executedAt) => onChange({ executedAt })}
      />
      <InputRow
        label={t`Quantity`}
        value={fill.quantity}
        onChangeText={(quantity) => onChange({ quantity })}
        placeholder="100"
        numeric
      />
      <InputRow
        label={t`Price`}
        value={fill.price}
        onChangeText={(price) => onChange({ price })}
        placeholder="10.50"
        numeric
      />
      <InputRow
        label={t`Fees`}
        value={fill.fees}
        onChangeText={(fees) => onChange({ fees })}
        placeholder="0.00"
        numeric
      />
      <InputRow
        label={t`Commission`}
        value={fill.commission}
        onChangeText={(commission) => onChange({ commission })}
        placeholder="0.00"
        numeric
      />
    </Card>
  );
}

/**
 * One symbol block: instrument, fills, plan, journal taxonomy, and dividend —
 * the web NewTradeDrawer's SymbolTradeBlock on the phone. The parent owns the
 * values; the block reports whole-value updates.
 */
function SymbolBlock({
  values,
  isNew,
  setups,
  tags,
  onChange,
}: {
  values: TradeFormValues;
  isNew: boolean;
  setups: Setup[];
  tags: Tag[];
  onChange: (next: TradeFormValues) => void;
}) {
  const set = <K extends keyof TradeFormValues>(key: K, value: TradeFormValues[K]) =>
    onChange({ ...values, [key]: value });

  const customTags = tags.filter((tag) => tag.kind !== 'mistake');
  const mistakeTags = tags.filter((tag) => tag.kind === 'mistake');

  const markets: { value: Market; label: string }[] = [
    { value: 'stock', label: t`Stock` },
    { value: 'option', label: t`Option` },
    { value: 'crypto', label: t`Crypto` },
    { value: 'future', label: t`Futures` },
    { value: 'forex', label: t`Forex` },
  ];
  const directions = [
    { value: 'long' as const, label: t`Long`, fill: PnlFill.pos },
    { value: 'short' as const, label: t`Short`, fill: PnlFill.neg },
  ] as const;
  const contracts = [
    { value: 'none' as const, label: t`None` },
    { value: 'call' as const, label: t`Call` },
    { value: 'put' as const, label: t`Put` },
  ];
  const grades = TRADE_GRADES.map((g) => ({ value: g, label: g }));

  function onSymbolChange(symbol: string) {
    const next = { ...values, symbol };
    // Typing a known futures root fills its point value, like the web presets.
    if (values.market === 'future' && !values.multiplier.trim()) {
      const preset = futuresMultiplierForSymbol(symbol);
      if (preset != null) next.multiplier = String(preset);
    }
    onChange(next);
  }

  function updateFill(key: string, patch: Partial<FillDraft>) {
    onChange({
      ...values,
      fills: values.fills.map((fill) => (fill.key === key ? { ...fill, ...patch } : fill)),
    });
  }

  return (
    <>
      {isNew ? (
        <Card>
          <ControlRow label={t`Market`}>
            <Segmented
              variant="menu"
              options={markets}
              value={values.market}
              onChange={(market) => set('market', market)}
            />
          </ControlRow>
          <InputRow
            label={t`Symbol`}
            value={values.symbol}
            onChangeText={onSymbolChange}
            placeholder="AAPL"
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <ControlRow label={t`Direction`}>
            <ValueToggle
              options={directions}
              value={values.direction}
              onChange={(direction) => set('direction', direction)}
            />
          </ControlRow>
          {values.market === 'option' ? (
            <ControlRow label={t`Contract`}>
              <Segmented
                variant="menu"
                options={contracts}
                value={values.optionRight || 'none'}
                onChange={(right) => set('optionRight', right === 'none' ? '' : right)}
              />
            </ControlRow>
          ) : null}
          {values.market === 'option' ? (
            <InputRow
              label={t`Strike`}
              value={values.optionStrike}
              onChangeText={(optionStrike) => set('optionStrike', optionStrike)}
              placeholder="705"
              numeric
            />
          ) : null}
          {values.market === 'option' ? (
            <InputRow
              label={t`Expiry`}
              value={values.optionExpiry}
              onChangeText={(optionExpiry) => set('optionExpiry', optionExpiry)}
              placeholder="2026-09-18"
              autoCorrect={false}
            />
          ) : null}
          {values.market === 'future' ? (
            <InputRow
              label={t`Point value`}
              value={values.multiplier}
              onChangeText={(multiplier) => set('multiplier', multiplier)}
              placeholder={t`Multiplier`}
              numeric
            />
          ) : null}
          {values.market === 'future' ? (
            <StackRow>
              <SingleChips
                options={FUTURES_PRESETS.map((p) => ({
                  value: String(p.multiplier),
                  label: p.label,
                }))}
                value={values.multiplier}
                onChange={(multiplier) => set('multiplier', multiplier)}
              />
            </StackRow>
          ) : null}
        </Card>
      ) : (
        <Card>
          <ControlRow label={t`Symbol`}>
            <Text style={styles.lockedSymbol}>{values.symbol}</Text>
          </ControlRow>
        </Card>
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
            onChange({ ...values, fills: values.fills.filter((f) => f.key !== fill.key) })
          }
        />
      ))}
      <View style={styles.actionRow}>
        <GlassButton
          label={t`Add fill`}
          systemImage="plus"
          onPress={() =>
            onChange({
              ...values,
              fills: [...values.fills, emptyFill(values.direction === 'long' ? 'sell' : 'buy')],
            })
          }
        />
      </View>

      <SectionHeader label={t`Plan`} />
      <Card>
        <InputRow
          label={t`Target`}
          value={values.target}
          onChangeText={(target) => set('target', target)}
          placeholder="0.00"
          numeric
        />
        <InputRow
          label={t`Stop`}
          value={values.stop}
          onChangeText={(stop) => set('stop', stop)}
          placeholder="0.00"
          numeric
        />
      </Card>

      {/*
        Journal splits in two because the trade does: everything you knew at
        entry, then everything you learned after. Kept as one card it ran ten
        rows deep and put the two identical A+…C rating pickers back to back,
        where the only thing telling them apart was a label.
      */}
      <SectionHeader label={t`Journal`} />
      <Card>
        {setups.length > 0 ? (
          <StackRow label={t`Setups`}>
            <ChipGroup
              options={setups.map((s) => ({ value: s.id, label: s.name }))}
              selected={values.setupIds}
              onToggle={(id) => set('setupIds', toggleIn(values.setupIds, id))}
            />
          </StackRow>
        ) : null}
        <StackRow label={t`Session`}>
          <SingleChips
            options={TRADE_SESSIONS.map((s) => ({ value: s, label: s }))}
            value={values.session}
            onChange={(session) => set('session', session)}
          />
        </StackRow>
        <StackRow label={t`Emotion`}>
          <ChipGroup
            options={EMOTIONAL_STATES.map((s) => ({ value: s, label: s }))}
            selected={values.emotions}
            onToggle={(s) => set('emotions', toggleIn(values.emotions, s))}
          />
        </StackRow>
        <StackRow label={t`Setup rating`}>
          <SingleChips
            options={grades}
            value={values.setupGrade}
            onChange={(setupGrade) => set('setupGrade', setupGrade)}
          />
        </StackRow>
        {customTags.length > 0 ? (
          <StackRow label={t`Tags`}>
            <ChipGroup
              options={customTags.map((tag) => ({ value: tag.id, label: tag.name }))}
              selected={values.tagIds}
              onToggle={(id) => set('tagIds', toggleIn(values.tagIds, id))}
            />
          </StackRow>
        ) : null}
        <NotesRow
          label={t`Entry reason`}
          value={values.entryReason}
          onChangeText={(entryReason) => set('entryReason', entryReason)}
          placeholder={t`Why did you enter?`}
        />
      </Card>

      <SectionHeader label={t`Review`} />
      <Card>
        <StackRow label={t`Execution rating`}>
          <SingleChips
            options={grades}
            value={values.executionGrade}
            onChange={(executionGrade) => set('executionGrade', executionGrade)}
          />
        </StackRow>
        {mistakeTags.length > 0 ? (
          <StackRow label={t`Mistake type`}>
            <ChipGroup
              options={mistakeTags.map((tag) => ({ value: tag.id, label: tag.name }))}
              selected={values.mistakeIds}
              onToggle={(id) => set('mistakeIds', toggleIn(values.mistakeIds, id))}
              tone="neg"
            />
          </StackRow>
        ) : null}
        <NotesRow
          label={t`Exit reason`}
          value={values.exitReason}
          onChangeText={(exitReason) => set('exitReason', exitReason)}
          placeholder={t`Why did you exit?`}
        />
        <NotesRow
          label={t`Review notes`}
          value={values.reviewNotes}
          onChangeText={(reviewNotes) => set('reviewNotes', reviewNotes)}
          placeholder={t`What would you do differently?`}
        />
      </Card>
      <SectionFooter label={t`Rate how you executed, not how it paid — a disciplined trade can still lose.`} />

      <SectionHeader label={t`Dividend`} />
      <Card>
        <InputRow
          label={t`Amount`}
          value={values.dividendAmount}
          onChangeText={(dividendAmount) => set('dividendAmount', dividendAmount)}
          placeholder="0.00"
          numeric
        />
        <DateRow
          label={t`Date`}
          selection={values.dividendDate}
          displayedComponents={['date']}
          onDateChange={(dividendDate) => set('dividendDate', dividendDate)}
        />
        <InputRow
          label={t`Note`}
          value={values.dividendNote}
          onChangeText={(dividendNote) => set('dividendNote', dividendNote)}
          placeholder={t`Optional`}
        />
      </Card>

      {isNew ? (
        <>
          <SectionHeader label={t`Screenshots`} />
          <ScreenshotQueue
            screenshots={values.screenshots}
            onChange={(screenshots) => set('screenshots', screenshots)}
          />
          <SectionFooter label={t`Uploaded to this symbol's trade when it saves. Tap a thumbnail to remove it.`} />
        </>
      ) : null}
    </>
  );
}

/**
 * Trade entry/edit form, field-parity with the web NewTradeDrawer: one or
 * more symbol blocks — each with instrument, fills, plan, journal, and
 * dividend. One Save logs every block as its own trade (the server groups
 * executions per symbol). New trades can prefill blocks from screenshot
 * scans or CSV/JSON files. Screens own submission.
 */
export function TradeForm({
  title,
  initialBlocks,
  accounts,
  setups,
  tags,
  saving,
  lockInstrument = false,
  footer,
  onSave,
}: {
  title: string;
  initialBlocks: TradeFormValues[];
  accounts: Account[];
  setups: Setup[];
  tags: Tag[];
  saving: boolean;
  /** Editing: single block; market/symbol/option/multiplier are not patchable server-side. */
  lockInstrument?: boolean;
  /** Edit-mode extra rendered after the block (e.g. the live attachments card). */
  footer?: ReactNode;
  onSave: (blocks: TradeFormValues[]) => void;
}) {
  const [blocks, setBlocks] = useState<TradeFormValues[]>(initialBlocks);
  const [active, setActive] = useState(0);
  const [accountId, setAccountId] = useState(
    initialBlocks[0]?.accountId || (accounts[0]?.id ?? ''),
  );
  const isNew = !lockInstrument;

  const updateBlock = (index: number, next: TradeFormValues) =>
    setBlocks((current) => current.map((block, i) => (i === index ? next : block)));

  const accountName = accounts.find((a) => a.id === accountId)?.name ?? '';
  const clampedActive = Math.min(active, blocks.length - 1);

  if (!isNew) {
    return (
      <FormSheet title={title} saving={saving} onSave={() => onSave(blocks)}>
        {accounts.length > 1 ? (
          <Card>
            <ControlRow label={t`Account`}>
              <Text style={styles.rowValue}>{accountName}</Text>
            </ControlRow>
          </Card>
        ) : null}
        {blocks[0] ? (
          <SymbolBlock
            values={blocks[0]}
            isNew={false}
            setups={setups}
            tags={tags}
            onChange={(next) => updateBlock(0, next)}
          />
        ) : null}
        {footer}
      </FormSheet>
    );
  }

  return (
    <FormSheet
      title={title}
      saving={saving}
      scroll={false}
      headerAccessory={
        <TradePrefillBar
          accountId={accountId}
          onPrefill={(prefilled) => {
            setBlocks(prefilled);
            setActive(0);
          }}
        />
      }
      onSave={() => onSave(blocks.map((block) => ({ ...block, accountId })))}
    >
      <SymbolPager
        tabs={blocks.map((block, index) => ({
          key: block.key,
          label: block.symbol.trim() ? block.symbol.trim().toUpperCase() : t`Symbol ${index + 1}`,
        }))}
        active={clampedActive}
        addLabel={t`Add symbol`}
        removeLabel={t`Remove symbol`}
        header={
          accounts.length > 1 ? (
            <Card>
              <ControlRow label={t`Account`}>
                <Segmented
                  variant="menu"
                  options={accounts.map((a) => ({ value: a.id, label: a.name }))}
                  value={accountId}
                  onChange={setAccountId}
                />
              </ControlRow>
            </Card>
          ) : null
        }
        onSelect={setActive}
        onAdd={() => {
          setBlocks((current) => [...current, emptyTradeForm(accountId)]);
          setActive(blocks.length);
        }}
        onRemoveActive={() => {
          setBlocks((current) => current.filter((_, i) => i !== clampedActive));
          setActive((current) => Math.max(0, current - 1));
        }}
        renderPage={(index) => {
          const block = blocks[index];
          return (
            <FormScrollArea>
              <SymbolBlock
                values={block}
                isNew
                setups={setups}
                tags={tags}
                onChange={(next) => updateBlock(index, next)}
              />
            </FormScrollArea>
          );
        }}
      />
    </FormSheet>
  );
}

const styles = StyleSheet.create((theme) => ({
  rowValue: { fontSize: 15, color: theme.colors.mutedForeground },
  fillHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xs,
  },
  fillTitle: { fontSize: 13, fontWeight: '600', color: theme.colors.mutedForeground },
  actionRow: { alignItems: 'center' },
  lockedSymbol: { fontSize: 17, fontWeight: '700', color: theme.colors.foreground },
  pressed: { opacity: 0.6 },
}));
