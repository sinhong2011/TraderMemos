import { DatePicker, Host } from '@expo/ui/swift-ui';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { TextInput, View } from 'react-native';
// react-native-pager-view, not @expo/ui's SwiftUI drop-in — see trade-form.tsx:
// the hosted pager never wires RN's touch handler into its pages, so every
// TextInput inside one silently ignores taps.
import PagerView from 'react-native-pager-view';
import Reanimated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { NoteSymbol, NoteType } from '@/api/types';
import { NoteImageButton, NoteImageStrip, useNoteImages } from '@/components/note-images';
import { Segmented } from '@/components/segmented';
import { SymbolPagerBar } from '@/components/symbol-pager-bar';
import { t } from '@lingui/core/macro';

/**
 * A symbol block being edited. `key` is local: two blank tickers still need
 * distinct identities for the tab strip and the pager's page list.
 */
export type SymbolDraft = NoteSymbol & { key: string };

let symbolSeq = 0;
function nextSymbolKey(): string {
  symbolSeq += 1;
  return `s${symbolSeq}`;
}

export type NoteFormValues = {
  type: NoteType;
  /** YYYY-MM-DD — the API stores occurred_at as an opaque date string. */
  occurredAt: string;
  title: string;
  body: string;
  symbols: SymbolDraft[];
};

function dayString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function emptyNoteValues(): NoteFormValues {
  return { type: 'note', occurredAt: dayString(new Date()), title: '', body: '', symbols: [] };
}

export function symbolDrafts(symbols: NoteSymbol[]): SymbolDraft[] {
  return symbols.map((symbol) => ({ ...symbol, key: nextSymbolKey() }));
}

/**
 * Strips the local `key` and drops blocks that never got a ticker — the shape
 * the API takes. Notes carry no symbols at all; only daily logs do.
 */
export function noteSymbolsFor(values: NoteFormValues): NoteSymbol[] {
  if (values.type !== 'daily_log') return [];
  return values.symbols
    .filter((symbol) => symbol.symbol.trim())
    .map((symbol) => ({ symbol: symbol.symbol.trim().toUpperCase(), body: symbol.body }));
}

/** True once there is anything worth persisting — drives the greyed-out Save. */
export function noteHasContent(values: NoteFormValues): boolean {
  return Boolean(values.body.trim() || values.title.trim() || noteSymbolsFor(values).length > 0);
}

/**
 * The Note / Daily log switch, as the sheet's *title* rather than a control
 * beside it (`FormSheet titleControl`). A segmented control wedged between
 * Cancel and Save made a three-control header out of a screen whose whole job
 * is a blank page; a pull-down reads as the title it replaces — one word and a
 * chevron — and keeps the type one tap away.
 */
export function NoteTypeSwitch({
  value,
  onChange,
}: {
  value: NoteType;
  onChange: (type: NoteType) => void;
}) {
  const types = [
    { value: 'note' as const, label: t`Note` },
    { value: 'daily_log' as const, label: t`Daily log` },
  ];
  return <Segmented variant="menu" options={types} value={value} onChange={onChange} />;
}

/**
 * One writing page: a headline field and the body beneath it, both borderless
 * on the page's own background. No boxes and no captions — the screen is the
 * field, so drawing a bordered shell around 168pt of it (and scrolling that
 * inside the form's scroll) is what made writing a note feel like filling in a
 * form. The body takes every point left over and scrolls itself.
 */
function WritingPage({
  headline,
  headlinePlaceholder,
  ticker = false,
  autoFocusHeadline = false,
  bodyRef,
  body,
  bodyPlaceholder,
  onChangeHeadline,
  onChangeBody,
}: {
  headline: string;
  headlinePlaceholder: string;
  /** Ticker headlines type upper case and skip autocorrect. */
  ticker?: boolean;
  /** Opens with the caret in the headline — a page the user just added. */
  autoFocusHeadline?: boolean;
  /** Lets the editor focus this page's body itself (the opening caret). */
  bodyRef?: React.RefObject<TextInput | null>;
  body: string;
  bodyPlaceholder: string;
  onChangeHeadline: (next: string) => void;
  onChangeBody: (next: string) => void;
}) {
  const { theme } = useUnistyles();
  const ownBodyRef = useRef<TextInput>(null);
  const bodyField = bodyRef ?? ownBodyRef;

  return (
    <View style={styles.page}>
      <TextInput
        value={headline}
        onChangeText={onChangeHeadline}
        placeholder={headlinePlaceholder}
        placeholderTextColor={theme.colors.mutedForeground}
        style={[styles.headline, ticker && styles.headlineTicker]}
        autoCapitalize={ticker ? 'characters' : 'sentences'}
        autoCorrect={!ticker}
        autoFocus={autoFocusHeadline}
        returnKeyType="next"
        // Return moves to the body instead of dismissing: the two fields are
        // one thought, and a headline field that closes the keyboard would make
        // the caret's next stop a guess.
        submitBehavior="submit"
        onSubmitEditing={() => bodyField.current?.focus()}
      />
      <TextInput
        ref={bodyField}
        value={body}
        onChangeText={onChangeBody}
        placeholder={bodyPlaceholder}
        placeholderTextColor={theme.colors.mutedForeground}
        style={styles.body}
        multiline
      />
    </View>
  );
}

/**
 * Full-screen note editor — the writing surface first, everything else in the
 * bar under it.
 *
 * Daily logs put their per-symbol recaps on swipeable pages beside the session
 * recap rather than below it, so a log with four symbols is still one screen
 * with one caret in it. The date lives in the toolbar as a compact native pill:
 * it is "today" nearly every time, and a labelled picker row was spending a
 * field's worth of the page on a value nobody edits.
 */
export function NoteEditor({
  values,
  onChange,
  autoFocus = false,
  trailingAction,
}: {
  values: NoteFormValues;
  onChange: (patch: Partial<NoteFormValues>) => void;
  /** Opens with the caret in the body — creation, not editing. */
  autoFocus?: boolean;
  /** Extra toolbar control pinned right (the edit screen's delete). */
  trailingAction?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const keyboard = useAnimatedKeyboard();
  const images = useNoteImages(values.body, (body) => onChange({ body }));
  const pager = useRef<PagerView>(null);
  const [page, setPage] = useState(0);
  /** Key of a symbol page that should open with its ticker focused. */
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);
  // Focused imperatively rather than with `autoFocus`: the pager remounts on
  // every add and remove (below), and a standing autoFocus on the recap would
  // yank the caret back from the page the user just asked for. This fires once,
  // when the editor itself mounts.
  const recapBody = useRef<TextInput>(null);
  useEffect(() => {
    if (autoFocus) recapBody.current?.focus();
  }, [autoFocus]);

  const isLog = values.type === 'daily_log';
  const pageCount = isLog ? values.symbols.length + 1 : 1;
  const active = Math.min(page, pageCount - 1);
  const onRecap = active === 0;

  function goTo(index: number) {
    setPage(index);
    pager.current?.setPage(index);
  }

  function patchSymbol(index: number, next: Partial<SymbolDraft>) {
    onChange({
      symbols: values.symbols.map((symbol, i) => (i === index ? { ...symbol, ...next } : symbol)),
    });
  }

  function addSymbol() {
    const key = nextSymbolKey();
    onChange({ symbols: [...values.symbols, { key, symbol: '', body: '' }] });
    setPendingFocus(key);
    setPage(values.symbols.length + 1);
  }

  function removeActiveSymbol() {
    onChange({ symbols: values.symbols.filter((_, i) => i !== active - 1) });
    setPage(Math.max(0, active - 1));
  }

  const recap = (
    <WritingPage
      headline={values.title}
      headlinePlaceholder={isLog ? t`Daily log` : t`Title`}
      bodyRef={recapBody}
      body={values.body}
      bodyPlaceholder={
        isLog
          ? t`How did the session go? Use "- [ ]" for checklist items.`
          : t`What happened today?`
      }
      onChangeHeadline={(title) => onChange({ title })}
      onChangeBody={(body) => onChange({ body })}
    />
  );

  // The whole editor shrinks by the keyboard instead of sliding under it: the
  // body has no scroll parent to inset (it is the scroller), so an unshrunk
  // surface would park the caret behind the keys.
  const lift = useAnimatedStyle(() => ({
    paddingBottom: Math.max(insets.bottom, keyboard.height.value),
  }));

  return (
    <Reanimated.View style={[styles.root, lift]}>
      {isLog ? (
        <View style={styles.strip}>
          <SymbolPagerBar
            tabs={[
              { key: 'recap', label: t`Recap`, fixed: true },
              ...values.symbols.map((symbol, index) => ({
                key: symbol.key,
                label: symbol.symbol.trim()
                  ? symbol.symbol.trim().toUpperCase()
                  : t`Symbol ${index + 1}`,
              })),
            ]}
            active={active}
            addLabel={t`Add symbol`}
            removeLabel={t`Remove symbol`}
            // A log's per-symbol recaps are optional down to none, unlike a
            // trade, which always has at least one symbol.
            keepLast={false}
            onSelect={goTo}
            onAdd={addSymbol}
            onRemoveActive={removeActiveSymbol}
          />
        </View>
      ) : null}

      {isLog ? (
        <PagerView
          ref={pager}
          style={styles.pager}
          // Remounting on page-count change is what keeps the pager's page list
          // in step with ours — it does not reconcile added or removed children.
          key={pageCount}
          initialPage={active}
          onPageSelected={(event) => {
            setPage(event.nativeEvent.position);
            // The added page has mounted focused by the time this lands, so
            // the request is spent — a later remount must not re-fire it.
            setPendingFocus(null);
          }}
        >
          <View key="recap" style={styles.pagerPage}>
            {recap}
          </View>
          {values.symbols.map((symbol, index) => (
            <View key={symbol.key} style={styles.pagerPage}>
              <WritingPage
                headline={symbol.symbol}
                headlinePlaceholder={t`Ticker`}
                ticker
                autoFocusHeadline={pendingFocus === symbol.key}
                body={symbol.body}
                bodyPlaceholder={
                  symbol.symbol.trim()
                    ? t`What did ${symbol.symbol.trim().toUpperCase()} do?`
                    : t`What did it do?`
                }
                onChangeHeadline={(ticker) => patchSymbol(index, { symbol: ticker })}
                onChangeBody={(body) => patchSymbol(index, { body })}
              />
            </View>
          ))}
        </PagerView>
      ) : (
        recap
      )}

      {onRecap ? <NoteImageStrip images={images} /> : null}

      <View style={styles.toolbar}>
        {/*
          `ignoreSafeArea` is load-bearing: a hosted SwiftUI view still insets
          its content by the container safe area, so a picker sitting this close
          to the home indicator draws its pill above its own frame.
        */}
        <Host matchContents ignoreSafeArea="all">
          <DatePicker
            // Noon-anchored so a UTC-shifted parse can never land on the
            // previous day (the fmtDayShort rule).
            selection={new Date(`${values.occurredAt}T12:00:00`)}
            displayedComponents={['date']}
            onDateChange={(date) => onChange({ occurredAt: dayString(new Date(date)) })}
          />
        </Host>
        {/* Charts attach to the note body, so the button only makes sense on
            the page that owns it. */}
        {onRecap ? <NoteImageButton images={images} /> : null}
        <View style={styles.toolbarSpacer} />
        {trailingAction}
      </View>
    </Reanimated.View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { flex: 1 },
  strip: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.sm },
  pager: { flex: 1 },
  pagerPage: { flex: 1 },
  // Capped and centred: prose set across a full iPad width is unreadable, and
  // the caret would be chasing 900pt lines.
  page: {
    flex: 1,
    width: '100%',
    maxWidth: theme.measure.form,
    alignSelf: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  headline: {
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 28,
    paddingVertical: theme.spacing.sm,
    color: theme.colors.foreground,
  },
  headlineTicker: { letterSpacing: 0.5 },
  body: {
    flex: 1,
    fontSize: 17,
    lineHeight: 24,
    paddingTop: theme.spacing.xs,
    textAlignVertical: 'top',
    color: theme.colors.foreground,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  toolbarSpacer: { flex: 1 },
}));
