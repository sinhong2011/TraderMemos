import { DatePicker, Host } from '@expo/ui/swift-ui';
import { SymbolView } from 'expo-symbols';
import { Children, Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';
// react-native-pager-view, not @expo/ui's SwiftUI drop-in: the hosted-SwiftUI
// pager never wires RN's touch handler into its pages, so every Pressable and
// TextInput inside a page (chips, Add fill, the toggles, every amount field)
// silently ignored taps. Same imperative API, so the swap is the import.
import PagerView from 'react-native-pager-view';
import Animated, {
  LinearTransition,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { Account, Setup, Tag } from '@/api/types';
import { ChipGroup } from '@/components/chips';
import { FormScrollArea, FormSheet } from '@/components/form-sheet';
import { ScreenshotQueue } from '@/components/screenshot-queue';
import { GlassButton, GlassIconButton } from '@/components/glass-button';
import { Segmented } from '@/components/segmented';
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

/** Muted uppercase grouped-section header. */
function SectionHeader({ label }: { label: string }) {
  return <Text style={styles.section}>{label}</Text>;
}

/** Grouped-list footer — the iOS place for a rule the fields can't state. */
function SectionFooter({ label }: { label: string }) {
  return <Text style={styles.sectionFooter}>{label}</Text>;
}

/** iOS inset-grouped card — children become rows split by inset hairlines. */
function Card({ children }: { children: ReactNode }) {
  const rows = Children.toArray(children);
  return (
    <View style={styles.card}>
      {rows.map((row, index) => (
        <Fragment key={index}>
          {index > 0 ? <View style={styles.separator} /> : null}
          {row}
        </Fragment>
      ))}
    </View>
  );
}

/** Native settings-row idiom: label left, right-aligned input. */
function InputRow({ label, ...props }: { label: string } & TextInputProps) {
  const { theme } = useUnistyles();
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={theme.colors.mutedForeground}
        style={styles.rowInput}
        {...props}
      />
    </View>
  );
}

/** Label left, any control (segmented / menu picker / text) right. */
function ControlRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowControl}>{children}</View>
    </View>
  );
}

/** Stacked label + full-width content (chip groups). */
function StackRow({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <View style={styles.stackRow}>
      {label ? <Text style={styles.rowLabel}>{label}</Text> : null}
      {children}
    </View>
  );
}

/** Borderless multiline row — the native notes-field idiom, no boxed input. */
function NotesRow({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}) {
  const { theme } = useUnistyles();
  return (
    <View style={styles.stackRow}>
      <Text style={styles.rowLabel}>{label}</Text>
      <TextInput
        multiline
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.mutedForeground}
        style={styles.notesInput}
      />
    </View>
  );
}

/**
 * Date/time row — same shape as every other row: our label leading, the
 * SwiftUI picker pinned trailing. The label has to be ours: passing `title`
 * makes SwiftUI draw its own leading label, and since the `Host` only hugs its
 * content, the pills end up parked mid-row with the right half empty.
 * Omitting `title` is what opts the picker into `.labelsHidden()`.
 */
function DateRow({
  label,
  selection,
  displayedComponents,
  onDateChange,
}: {
  label: string;
  selection: Date;
  displayedComponents: ('date' | 'hourAndMinute')[];
  onDateChange: (date: Date) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.rowControl}>
        {/*
          `ignoreSafeArea` is load-bearing: a hosted SwiftUI view still insets
          its content by the container safe area, so a picker sitting inside
          the home-indicator band — the dividend Date row, last card on the
          page — drew its pill ~20pt above its own frame, over the row divider.
          'all' also keeps the keyboard inset out of it while a field is open.
        */}
        <Host matchContents ignoreSafeArea="all">
          <DatePicker
            selection={selection}
            displayedComponents={displayedComponents}
            onDateChange={onDateChange}
          />
        </Host>
      </View>
    </View>
  );
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
      select="single"
    />
  );
}

function toggleIn(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/**
 * One fluid motion for the whole tab strip: SwiftUI's `.smooth` spring model
 * (perceptual duration + damping ratio rather than stiffness/mass), damped just
 * under critical so everything glides to rest without a bounce. DESIGN.md's
 * 150ms ease-out rule is written for the web; iOS motion is springs.
 */
const TAB_SPRING = { duration: 420, dampingRatio: 0.85 } as const;
const TAB_TRANSITION = LinearTransition.springify()
  .duration(TAB_SPRING.duration)
  .dampingRatio(TAB_SPRING.dampingRatio);

/**
 * Entering tabs swell the last few percent into place on that spring while they
 * fade in, so the strip grows like liquid instead of blinking on at full size.
 * Hand-rolled rather than `ZoomIn` because ZoomIn starts at scale 0, and that
 * big a jump is exactly the pop this replaces. Appending doesn't move existing
 * tabs, so without this the layout spring has nothing to animate.
 */
function tabEnter() {
  'worklet';
  return {
    initialValues: { opacity: 0, transform: [{ scale: 0.92 }] },
    animations: {
      opacity: withTiming(1, { duration: 200 }),
      transform: [{ scale: withSpring(1, TAB_SPRING) }],
    },
  };
}

/** Mirror of the entrance, quicker — a removed glyph shouldn't linger. */
function tabExit() {
  'worklet';
  return {
    initialValues: { opacity: 1, transform: [{ scale: 1 }] },
    animations: {
      opacity: withTiming(0, { duration: 140 }),
      transform: [{ scale: withTiming(0.92, { duration: 140 }) }],
    },
  };
}

/**
 * Removing a symbol: the tab squeezes shut on the very spring that carries its
 * neighbours into the gap, so the strip closes as one motion. Previously the
 * chip blinked out in 140ms and left a hole that the 420ms layout spring then
 * spent three times as long closing — two animations, visibly out of step.
 * `currentWidth` is what makes it possible: an exiting view is detached from
 * layout, so without seeding its measured width there is nothing to animate
 * from. The wrapper clips (`tabSlot`) so the label is wiped rather than
 * spilling out of the shrinking capsule.
 */
function tabCollapse(values: { currentWidth: number }) {
  'worklet';
  return {
    initialValues: { opacity: 1, width: values.currentWidth, transform: [{ scale: 1 }] },
    animations: {
      // Fades well before the width lands, so the ghost never sits on top of
      // the neighbour sliding underneath it.
      opacity: withTiming(0, { duration: 160 }),
      width: withSpring(0, TAB_SPRING),
      transform: [{ scale: withSpring(0.9, TAB_SPRING) }],
    },
  };
}

/**
 * One symbol tab. The selection fill is an animated layer rather than a
 * conditional background: removing the active tab hands the highlight to its
 * neighbour, and swapping that on instantly reads as a second jump landing on
 * top of the collapse.
 */
function SymbolTab({
  label,
  isActive,
  removable,
  onPress,
  onRemove,
}: {
  label: string;
  isActive: boolean;
  removable: boolean;
  onPress: () => void;
  onRemove: () => void;
}) {
  const { theme } = useUnistyles();
  const fill = useAnimatedStyle(() => ({ opacity: withSpring(isActive ? 1 : 0, TAB_SPRING) }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
    >
      <Animated.View pointerEvents="none" style={[styles.tabFill, fill]} />
      <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]} numberOfLines={1}>
        {label}
      </Text>
      {isActive && removable ? (
        <Animated.View entering={tabEnter} exiting={tabExit}>
          <Pressable
            onPress={onRemove}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t`Remove symbol`}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <SymbolView
              name="xmark.circle.fill"
              size={15}
              tintColor={theme.colors.mutedForeground}
            />
          </Pressable>
        </Animated.View>
      ) : null}
    </Pressable>
  );
}

/**
 * Symbol tab list — a filled segmented capsule (deliberately distinct from
 * the bordered tag chips: this switches pages, it doesn't toggle values).
 * Follows the iOS token-field idiom: the selected tab reveals its own inline
 * clear glyph, and appending lives in a separate glass button pinned right of
 * the capsule so it stays reachable once the tabs overflow and scroll.
 */
function SymbolPagerBar({
  blocks,
  active,
  onSelect,
  onAdd,
  onRemoveActive,
}: {
  blocks: TradeFormValues[];
  active: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onRemoveActive: () => void;
}) {
  const removable = blocks.length > 1;
  return (
    <View style={styles.pagerRow}>
      <Animated.ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabList}
        style={styles.tabScroll}
      >
        {blocks.map((block, index) => (
          <Animated.View
            key={block.key}
            style={styles.tabSlot}
            entering={tabEnter}
            exiting={tabCollapse}
            layout={TAB_TRANSITION}
          >
            <SymbolTab
              label={
                block.symbol.trim() ? block.symbol.trim().toUpperCase() : t`Symbol ${index + 1}`
              }
              isActive={index === active}
              removable={removable}
              onPress={() => onSelect(index)}
              onRemove={onRemoveActive}
            />
          </Animated.View>
        ))}
      </Animated.ScrollView>
      <GlassIconButton systemImage="plus" label={t`Add symbol`} onPress={onAdd} />
    </View>
  );
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
        keyboardType="decimal-pad"
      />
      <InputRow
        label={t`Price`}
        value={fill.price}
        onChangeText={(price) => onChange({ price })}
        placeholder="10.50"
        keyboardType="decimal-pad"
      />
      <InputRow
        label={t`Fees`}
        value={fill.fees}
        onChangeText={(fees) => onChange({ fees })}
        placeholder="0.00"
        keyboardType="decimal-pad"
      />
      <InputRow
        label={t`Commission`}
        value={fill.commission}
        onChangeText={(commission) => onChange({ commission })}
        placeholder="0.00"
        keyboardType="decimal-pad"
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
              keyboardType="decimal-pad"
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
              keyboardType="decimal-pad"
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
          keyboardType="decimal-pad"
        />
        <InputRow
          label={t`Stop`}
          value={values.stop}
          onChangeText={(stop) => set('stop', stop)}
          placeholder="0.00"
          keyboardType="decimal-pad"
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
          keyboardType="decimal-pad"
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
  const pagerRef = useRef<PagerView>(null);
  const isNew = !lockInstrument;

  const updateBlock = (index: number, next: TradeFormValues) =>
    setBlocks((current) => current.map((block, i) => (i === index ? next : block)));

  const accountName = accounts.find((a) => a.id === accountId)?.name ?? '';
  const clampedActive = Math.min(active, blocks.length - 1);

  // Tab taps / add / prefill drive `active`; swipes report back through
  // onPageSelected (re-asserting the page they landed on is a no-op).
  // Neighbours slide, so adding a symbol carries the form across instead of
  // cutting to it — the pager's own motion, which keeps content on screen the
  // whole way and needs no opacity (see the page comment below). Longer jumps
  // cut, because animating them smears through every symbol in between.
  const shownPage = useRef(0);
  useEffect(() => {
    const pager = pagerRef.current;
    if (!pager) return;
    const previous = shownPage.current;
    shownPage.current = clampedActive;
    if (Math.abs(clampedActive - previous) === 1) pager.setPage(clampedActive);
    else pager.setPageWithoutAnimation(clampedActive);
  }, [clampedActive, blocks.length]);

  // Appending a symbol can't move the pager in the same commit that mounts the
  // page. The pager is a SwiftUI ScrollView over a LazyHStack driven by
  // `.scrollPosition(id:)`: the id has to name a page the stack has already
  // materialised, and the RN form inside it is still rendering for a frame or
  // two after the commit. Writing the id straight away lands the scroll on an
  // empty page and the form pops in afterwards — the flash. So append first,
  // let the page lay out, and only then hand it to the pager, which is when the
  // effect above sees a one-step move and slides.
  const pendingPage = useRef<number | null>(null);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealPending = () => {
    const target = pendingPage.current;
    if (target == null) return;
    pendingPage.current = null;
    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    pendingTimer.current = null;
    setActive(target);
  };
  useEffect(
    () => () => {
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
    },
    [],
  );

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
      <View style={styles.pagerTop}>
        {accounts.length > 1 ? (
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
        ) : null}
        <SymbolPagerBar
          blocks={blocks}
          active={clampedActive}
          onSelect={setActive}
          onAdd={() => {
            pendingPage.current = blocks.length;
            setBlocks((current) => [...current, emptyTradeForm(accountId)]);
            // Safety net: a page the pager keeps fully off-screen may never
            // report layout, and a symbol you can't reach is worse than a cut.
            pendingTimer.current = setTimeout(revealPending, 160);
          }}
          onRemoveActive={() => {
            setBlocks((current) => current.filter((_, i) => i !== clampedActive));
            setActive((current) => Math.max(0, current - 1));
          }}
        />
      </View>
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        onPageSelected={(event) => setActive(event.nativeEvent.position)}
      >
        {blocks.map((block, index) => (
          // Plain View, never an opacity-animated one: these pages host
          // GlassView buttons, and iOS drops a visual-effect view's backdrop
          // for good once an ancestor's opacity leaves 1. Page motion has to
          // come from the pager itself.
          <View
            key={block.key}
            style={styles.page}
            onLayout={() => {
              if (index === pendingPage.current) revealPending();
            }}
          >
            <FormScrollArea>
              <SymbolBlock
                values={block}
                isNew
                setups={setups}
                tags={tags}
                onChange={(next) => updateBlock(index, next)}
              />
            </FormScrollArea>
          </View>
        ))}
      </PagerView>
    </FormSheet>
  );
}

const styles = StyleSheet.create((theme) => ({
  section: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: theme.colors.mutedForeground,
    marginTop: theme.spacing.sm,
    paddingLeft: theme.spacing.lg,
  },
  sectionFooter: {
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.mutedForeground,
    marginTop: -theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
  },
  card: {
    borderRadius: theme.radius.lg + 6,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.card,
    overflow: 'hidden',
  },
  separator: {
    height: 0.5,
    marginLeft: theme.spacing.lg,
    backgroundColor: theme.colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    minHeight: 48,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xs,
  },
  rowLabel: { fontSize: 15, color: theme.colors.foreground },
  rowValue: { fontSize: 15, color: theme.colors.mutedForeground },
  rowInput: {
    flex: 1,
    textAlign: 'right',
    fontSize: 16,
    color: theme.colors.foreground,
    paddingVertical: theme.spacing.sm,
  },
  rowControl: { marginLeft: 'auto', flexShrink: 1 },
  stackRow: {
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  notesInput: {
    minHeight: 56,
    fontSize: 16,
    color: theme.colors.foreground,
    textAlignVertical: 'top',
    padding: 0,
  },
  fillHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xs,
  },
  fillTitle: { fontSize: 13, fontWeight: '600', color: theme.colors.mutedForeground },
  pagerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  // Filled tab capsule — the page-switcher family (segmented control), kept
  // visually apart from the bordered tag chips which toggle values.
  tabScroll: {
    flexGrow: 0,
    flexShrink: 1,
    borderRadius: theme.radius.full,
    borderCurve: 'continuous',
    // iOS 26 bordered capsule — the hairline carries the affordance (chips.tsx).
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  tabList: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    padding: 3,
  },
  // 34 + 3pt of capsule padding either side lines the tab strip up with the
  // 40pt glass "+" button beside it.
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs + 2,
    minWidth: 44,
    minHeight: 34,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.full,
    borderCurve: 'continuous',
  },
  // Clips the label while `tabCollapse` squeezes the slot shut.
  tabSlot: { overflow: 'hidden' },
  tabFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: theme.radius.full,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.input,
    // Start hidden so the animated opacity has a defined origin — otherwise a
    // freshly mounted inactive tab paints one filled frame before settling.
    opacity: 0,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '500',
    maxWidth: 140,
    color: theme.colors.mutedForeground,
  },
  tabLabelActive: { color: theme.colors.foreground, fontWeight: '600' },
  pagerTop: {
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.sm,
  },
  pager: { flex: 1 },
  page: { flex: 1 },
  actionRow: { alignItems: 'center' },
  lockedSymbol: { fontSize: 17, fontWeight: '700', color: theme.colors.foreground },
  pressed: { opacity: 0.6 },
}));
