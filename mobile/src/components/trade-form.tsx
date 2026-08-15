
import { useRef, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { FadeInDown, LinearTransition, SlideOutLeft } from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Icon } from '@/components/icon';
import type { Account, Setup, Tag } from '@/api/types';
import { AccountPill } from '@/components/account-pill';
import { ChipGroup } from '@/components/chips';
import {
  Card,
  CollapsibleSection,
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
import { RatingIndicator } from '@/components/rating-indicator';
import { Segmented } from '@/components/segmented';
import { SymbolPager } from '@/components/symbol-pager';
import { TradePrefillBar } from '@/components/trade-prefill-bar';
import { TradeResultCard } from '@/components/trade-result-card';
import { TradeScanOverlay } from '@/components/trade-scan-overlay';
import { ValueToggle } from '@/components/value-toggle';
import { PnlFill, pnlColor } from '@/styles/unistyles';
import { t } from '@lingui/core/macro';
import {
  EMOTIONAL_STATES,
  FUTURES_PRESETS,
  TRADE_SESSIONS,
  futuresMultiplierForSymbol,
  gradeFromInt,
  intFromGrade,
} from '@/lib/journal';
import {
  emptyFill,
  emptyTradeForm,
  nextFillKey,
  type FillDraft,
  type Market,
  type TradeFormValues,
} from '@/lib/trade-form';
import { useFormatters } from '@/lib/format';
import type { ImportSource } from '@/lib/trade-import';
import { blockFillPnls, blockPnlPreview } from '@/lib/trade-pnl-preview';

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

/** The app's one spring (see symbol-pager-bar.tsx) — fill-list motion matches. */
const FILL_SPRING = { duration: 420, dampingRatio: 0.85 } as const;
const FILL_ENTER = FadeInDown.springify()
  .duration(FILL_SPRING.duration)
  .dampingRatio(FILL_SPRING.dampingRatio);
// A deleted card continues out the way the swipe was already heading.
const FILL_EXIT = SlideOutLeft.duration(220);
const FILL_LAYOUT = LinearTransition.springify()
  .duration(FILL_SPRING.duration)
  .dampingRatio(FILL_SPRING.dampingRatio);

function FillCard({
  fill,
  index,
  pnl,
  currency,
  removable,
  onChange,
  onRemove,
  onDuplicate,
}: {
  fill: FillDraft;
  index: number;
  /** Realized net this closing fill locked in; null while it only opens size. */
  pnl: number | null;
  currency: string;
  removable: boolean;
  onChange: (patch: Partial<FillDraft>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  const swipeable = useRef<SwipeableMethods>(null);
  const { theme } = useUnistyles();
  const { formatPnl } = useFormatters();
  const sides = [
    { value: 'buy' as const, label: t`Buy`, fill: PnlFill.pos },
    { value: 'sell' as const, label: t`Sell`, fill: PnlFill.neg },
  ] as const;

  const card = (
    <Card>
      <View style={styles.fillHeader}>
        <Text style={styles.fillTitle}>{t`Fill ${index + 1}`}</Text>
        {/* What this fill locked in, on the header's trailing edge. A fill that
            only opens size has nothing to realize yet — it reads "Open" rather
            than a blank slot, so the column never looks like a failed render. */}
        {pnl != null ? (
          <Text style={[styles.fillPnl, { color: pnlColor(theme.colors, pnl) }]} numberOfLines={1}>
            {formatPnl(pnl, currency)}
          </Text>
        ) : (
          <Text style={styles.fillPnlOpen}>{t`Open`}</Text>
        )}
      </View>
      <ControlRow label={t`Side`}>
        <ValueToggle options={sides} value={fill.side} onChange={(side) => onChange({ side })} />
      </ControlRow>
      <DateRow
        label={t`Executed at`}
        selection={fill.executedAt}
        displayedComponents={['date', 'hourAndMinute']}
        // Fills are timestamped to the second — brokers report them that way,
        // and the server replays a trade's executions in `executed_at, id`
        // order, so the seconds are what sequence two legs of the same minute.
        seconds
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
      {/* One combined cost field, like the web drawer's Fee cell; imports that
          carry a separate commission keep it in the draft and it still posts. */}
      <InputRow
        label={t`Fees`}
        value={fill.fees}
        onChangeText={(fees) => onChange({ fees })}
        placeholder="0.00"
        numeric
      />
    </Card>
  );

  // List-style swipe actions on the whole card, like every iOS grouped list:
  // trailing swipe deletes (the one delete affordance), leading swipe
  // duplicates — a scale-out leg is usually the last fill with one field
  // changed, so copy-and-tweak beats retyping.
  return (
    <ReanimatedSwipeable
      ref={swipeable}
      friction={2}
      leftThreshold={40}
      rightThreshold={40}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={() => (
        <Pressable
          onPress={() => {
            swipeable.current?.close();
            onDuplicate();
          }}
          accessibilityRole="button"
          accessibilityLabel={t`Duplicate fill`}
          style={({ pressed }) => [styles.swipeDuplicate, pressed && styles.pressed]}
        >
          <Icon name="plus.square.on.square" size={18} tintColor="#FFFFFF" />
        </Pressable>
      )}
      renderRightActions={
        removable
          ? () => (
              <Pressable
                onPress={onRemove}
                accessibilityRole="button"
                accessibilityLabel={t`Remove fill`}
                style={({ pressed }) => [styles.swipeDelete, pressed && styles.pressed]}
              >
                <Icon name="trash.fill" size={18} tintColor="#FFFFFF" />
              </Pressable>
            )
          : undefined
      }
    >
      {card}
    </ReanimatedSwipeable>
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
  currency,
  onChange,
}: {
  values: TradeFormValues;
  isNew: boolean;
  setups: Setup[];
  tags: Tag[];
  currency: string;
  onChange: (next: TradeFormValues) => void;
}) {
  const set = <K extends keyof TradeFormValues>(key: K, value: TradeFormValues[K]) =>
    onChange({ ...values, [key]: value });

  // The fills present at mount — only genuinely new cards play the entering
  // animation, not the initial render (or paging back to this symbol).
  const [initialFillKeys] = useState(() => new Set(values.fills.map((fill) => fill.key)));

  /**
   * `FILL_LAYOUT` describes the list *changing* — a card added, removed or
   * duplicated. A `LinearTransition` interpolates from the view's previous
   * frame and has none on mount, so leaving it always-on animated the fills and
   * the whole block beneath them out of an empty rect every time this form
   * mounted, which read as the form sliding in from the top.
   *
   * It only showed from the *second* entry onward: on the first, the account /
   * setup / tag queries are cold, `FormSkeleton` covers the push, and the form
   * mounts onto an already-settled screen. Warm cache on later entries means it
   * mounts mid-push, where the same animation is plainly visible.
   *
   * Armed by the mutations themselves, so the glide still happens for exactly
   * the case it was written for — and `setState` in an event handler is fine,
   * unlike the effect-based gate this repo's lint rejects.
   */
  const [fillsMoved, setFillsMoved] = useState(false);

  const customTags = tags.filter((tag) => tag.kind !== 'mistake');
  const mistakeTags = tags.filter((tag) => tag.kind === 'mistake');

  // Journal, review and dividend fold closed on a fresh entry so logging the
  // trade stays one screen; anything already holding data (editing, prefill)
  // must never hide behind a chevron.
  const journalOpen =
    !isNew ||
    values.setupIds.length > 0 ||
    values.session !== '' ||
    values.emotions.length > 0 ||
    values.setupGrade !== '' ||
    values.tagIds.length > 0 ||
    values.entryReason !== '';
  const reviewOpen =
    !isNew ||
    values.executionGrade !== '' ||
    values.mistakeIds.length > 0 ||
    values.exitReason !== '' ||
    values.reviewNotes !== '';
  const dividendOpen = !isNew || values.dividendAmount !== '';

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

  /** Insert a copy right below its source — same leg, ready to tweak. */
  function duplicateFill(key: string) {
    setFillsMoved(true);
    onChange({
      ...values,
      fills: values.fills.flatMap((fill) =>
        fill.key === key ? [fill, { ...fill, id: undefined, key: nextFillKey() }] : [fill],
      ),
    });
  }

  // FIFO matching runs over the whole list, so the per-fill nets are computed
  // once for the block rather than card by card.
  const fillPnls = blockFillPnls(values);

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
        <Animated.View
          key={fill.key}
          entering={initialFillKeys.has(fill.key) ? undefined : FILL_ENTER}
          exiting={FILL_EXIT}
          layout={fillsMoved ? FILL_LAYOUT : undefined}
        >
          <FillCard
            fill={fill}
            index={index}
            pnl={fillPnls[index] ?? null}
            currency={currency}
            removable={values.fills.length > 1}
            onChange={(patch) => updateFill(fill.key, patch)}
            onRemove={() => {
              setFillsMoved(true);
              onChange({
                ...values,
                fills: values.fills.filter((f) => f.key !== fill.key),
              });
            }}
            onDuplicate={() => duplicateFill(fill.key)}
          />
        </Animated.View>
      ))}
      {/* One layout-animated wrapper: everything below the fills glides into
          place when a card is added or removed instead of snapping. */}
      <Animated.View layout={fillsMoved ? FILL_LAYOUT : undefined} style={styles.afterFills}>
        <View style={styles.actionRow}>
          <GlassButton
            label={t`Add fill`}
            systemImage="plus"
            onPress={() => {
              setFillsMoved(true);
              onChange({
                ...values,
                fills: [...values.fills, emptyFill(values.direction === 'long' ? 'sell' : 'buy')],
              });
            }}
          />
        </View>

        <TradeResultCard preview={blockPnlPreview(values)} currency={currency} />

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
        rows deep and put the two rating pickers back to back, where the only
        thing telling them apart was a label.
      */}
        <CollapsibleSection label={t`Journal`} defaultOpen={journalOpen}>
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
            {/*
          Both ratings are ranks, so they get the rank control: five stars over
          the same A+ … C ints (see rating-indicator.tsx). The letter still rides
          along beside them because everything downstream speaks it — the detail
          screen's grade tile, the coach copy ("You marked setup B").
        */}
            <StackRow label={t`Setup rating`}>
              <RatingIndicator
                label={t`Setup rating`}
                value={intFromGrade(values.setupGrade) ?? 0}
                caption={values.setupGrade}
                onChange={(stars) => set('setupGrade', gradeFromInt(stars))}
              />
            </StackRow>
            {customTags.length > 0 ? (
              <StackRow label={t`Tags`}>
                <ChipGroup
                  options={customTags.map((tag) => ({
                    value: tag.id,
                    label: tag.name,
                  }))}
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
        </CollapsibleSection>

        <CollapsibleSection label={t`Review`} defaultOpen={reviewOpen}>
          <Card>
            <StackRow label={t`Execution rating`}>
              <RatingIndicator
                label={t`Execution rating`}
                value={intFromGrade(values.executionGrade) ?? 0}
                caption={values.executionGrade}
                onChange={(stars) => set('executionGrade', gradeFromInt(stars))}
              />
            </StackRow>
            {mistakeTags.length > 0 ? (
              <StackRow label={t`Mistake type`}>
                <ChipGroup
                  options={mistakeTags.map((tag) => ({
                    value: tag.id,
                    label: tag.name,
                  }))}
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
        </CollapsibleSection>

        <CollapsibleSection label={t`Dividend`} defaultOpen={dividendOpen}>
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
        </CollapsibleSection>

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
      </Animated.View>
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
  pushed = false,
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
  /** The screen is pushed as a card, not presented — see FormSheet. */
  pushed?: boolean;
  /** Edit-mode extra rendered after the block (e.g. the live attachments card). */
  footer?: ReactNode;
  onSave: (blocks: TradeFormValues[]) => void;
}) {
  const [blocks, setBlocks] = useState<TradeFormValues[]>(initialBlocks);
  const [active, setActive] = useState(0);
  const [accountId, setAccountId] = useState(
    initialBlocks[0]?.accountId || (accounts[0]?.id ?? ''),
  );
  // Files picked from the Import menu, awaiting the scan overlay's parse +
  // review pass; the form only changes when the user confirms "Fill form".
  const [scanSources, setScanSources] = useState<ImportSource[] | null>(null);
  const isNew = !lockInstrument;

  const updateBlock = (index: number, next: TradeFormValues) =>
    setBlocks((current) => current.map((block, i) => (i === index ? next : block)));

  const account = accounts.find((a) => a.id === accountId);
  const accountName = account?.name ?? '';
  const currency = account?.base_currency ?? 'USD';
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
            currency={currency}
            onChange={(next) => updateBlock(0, next)}
          />
        ) : null}
        {footer}
      </FormSheet>
    );
  }

  return (
    <View style={styles.flexRoot}>
      <FormSheet
        title={title}
        saving={saving}
        scroll={false}
        pushed={pushed}
        saveLabel={t`Preview`}
        saveIcon="eye"
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
            // One shallow pinned row: account (always named, picker when there
            // is a choice) left, the scan trigger as an icon on the right.
            <View style={styles.headerRow}>
              <AccountPill accounts={accounts} value={accountId} onChange={setAccountId} />
              <View style={styles.headerEnd}>
                <TradePrefillBar onSources={setScanSources} />
              </View>
            </View>
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
                  currency={currency}
                  onChange={(next) => updateBlock(index, next)}
                />
              </FormScrollArea>
            );
          }}
        />
      </FormSheet>
      {scanSources ? (
        <TradeScanOverlay
          sources={scanSources}
          accountId={accountId}
          currency={currency}
          onApply={(prefilled) => {
            setBlocks(prefilled);
            setActive(0);
            setScanSources(null);
          }}
          onClose={() => setScanSources(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  flexRoot: { flex: 1 },
  rowValue: { fontSize: 15, color: theme.colors.mutedForeground },
  // No left inset: the account capsule now starts on the same edge as the tab
  // strip's capsule below it, so the pinned area reads as two stacked controls.
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  headerEnd: { marginLeft: 'auto' },
  fillHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xs,
  },
  fillTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.mutedForeground,
  },
  fillPnl: {
    fontSize: 13,
    fontWeight: '600',
    ...theme.numeric,
  },
  fillPnlOpen: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors.mutedForeground,
  },
  actionRow: { alignItems: 'center' },
  // Mirrors the form column's gap — this wrapper exists purely so the tail of
  // the block rides one layout transition when the fill list changes height.
  afterFills: { gap: theme.spacing.lg },
  swipeDelete: {
    width: 72,
    marginLeft: theme.spacing.sm,
    borderRadius: theme.radius.lg + 6,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.destructive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeDuplicate: {
    width: 72,
    marginRight: theme.spacing.sm,
    borderRadius: theme.radius.lg + 6,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedSymbol: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.foreground,
  },
  pressed: { opacity: 0.6 },
}));
