import { DatePicker } from '@expo/ui/swift-ui';
import { SymbolView } from 'expo-symbols';
import { Children, Fragment, useState, type ReactNode } from 'react';
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { NumericField } from '@/components/numeric-field';
import { AppHost } from '@/components/app-host';
import { Segmented } from '@/components/segmented';

/** The app's one spring (see symbol-pager-bar.tsx) — accordion motion matches. */
const ACCORDION_SPRING = { duration: 420, dampingRatio: 0.85 } as const;

/**
 * The inset-grouped row vocabulary shared by the creation sheets (trade form,
 * cash form). These are plain RN — a SwiftUI `Form` can't host chip groups,
 * pagers or the screenshot queue, so the forms that need those build the
 * grouped look themselves and everything else matches them.
 *
 * Settings *screens* are the other idiom: those stay real SwiftUI Forms via
 * `settings-form.tsx`.
 */

/** Muted uppercase grouped-section header. */
export function SectionHeader({ label }: { label: string }) {
  return <Text style={styles.section}>{label}</Text>;
}

/** Grouped-list footer — the iOS place for a rule the fields can't state. */
export function SectionFooter({ label }: { label: string }) {
  return <Text style={styles.sectionFooter}>{label}</Text>;
}

/**
 * SectionHeader that folds its content like an accordion — the optional back
 * half of a form (journal, dividend) starts closed so the required fields stay
 * one screen tall. `defaultOpen` is read once at mount; seed it from whether
 * the section already holds data so nothing filled ever hides.
 *
 * The body stays mounted inside a clipped, height-animated container (the
 * standard measure-and-spring accordion): inputs keep their state while
 * closed, and the open/close glides on the app's shared spring instead of the
 * content snapping in. The chevron rotation runs off the same progress value,
 * so glyph and fold always agree.
 */
export function CollapsibleSection({
  label,
  defaultOpen = false,
  children,
}: {
  label: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const progress = useSharedValue(defaultOpen ? 1 : 0);
  // Written by onLayout directly (no spring): a late first measure or a chip
  // row reflowing must resize the open section instantly, not re-animate it.
  const contentHeight = useSharedValue(0);
  const { theme } = useUnistyles();

  const toggle = () => {
    const next = !open;
    setOpen(next);
    progress.value = withSpring(next ? 1 : 0, ACCORDION_SPRING);
  };

  const body = useAnimatedStyle(() => ({
    height: progress.value * contentHeight.value,
    opacity: progress.value,
  }));
  const chevron = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 90}deg` }],
  }));

  return (
    <View>
      <Pressable
        onPress={toggle}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.collapseHeader, pressed && styles.collapsePressed]}
      >
        <Text style={styles.collapseLabel}>{label}</Text>
        <Animated.View style={chevron}>
          <SymbolView
            name="chevron.forward"
            size={11}
            weight="semibold"
            tintColor={theme.colors.mutedForeground}
          />
        </Animated.View>
      </Pressable>
      <Animated.View style={[styles.collapseClip, body]} pointerEvents={open ? 'auto' : 'none'}>
        <View
          style={styles.collapseInner}
          onLayout={(event) => {
            // eslint-disable-next-line react-hooks/immutability -- reanimated shared value
            contentHeight.value = event.nativeEvent.layout.height;
          }}
        >
          {children}
        </View>
      </Animated.View>
    </View>
  );
}

/** iOS inset-grouped card — children become rows split by inset hairlines. */
export function Card({ children }: { children: ReactNode }) {
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

/**
 * Native settings-row idiom: label left, right-aligned input. `numeric` swaps
 * in the `NumericField` — a number field is its own control here, not a text
 * field wearing a numeric keyboard (see numeric-field.tsx).
 */
export function InputRow({
  label,
  numeric,
  decimals,
  onChangeText,
  ...props
}: { label: string; numeric?: boolean; decimals?: boolean } & TextInputProps) {
  const { theme } = useUnistyles();
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {numeric ? (
        <NumericField
          align="trailing"
          value={props.value ?? ''}
          onChangeText={onChangeText ?? (() => {})}
          placeholder={props.placeholder}
          decimals={decimals}
          // The numeric branch is a SwiftUI field, not a TextInput — RN's
          // autoFocus would be dropped silently unless it's forwarded.
          autoFocus={props.autoFocus}
        />
      ) : (
        <TextInput
          placeholderTextColor={theme.colors.mutedForeground}
          style={styles.rowInput}
          onChangeText={onChangeText}
          {...props}
        />
      )}
    </View>
  );
}

/** Label left, any control (segmented / menu picker / text) right. */
export function ControlRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowControl}>{children}</View>
    </View>
  );
}

/** Stacked label + full-width content (chip groups). */
export function StackRow({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <View style={styles.stackRow}>
      {label ? <Text style={styles.rowLabel}>{label}</Text> : null}
      {children}
    </View>
  );
}

/** Borderless multiline row — the native notes-field idiom, no boxed input. */
export function NotesRow({
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

/** Two digits, the way a clock writes them — 7 seconds past reads `:07`. */
const padSeconds = (value: number) => String(value).padStart(2, '0');

/** `:00` … `:59`, built once — the separator lives in the label so the pill
 *  reads as a continuation of the time beside it. */
const SECOND_OPTIONS = Array.from({ length: 60 }, (_, second) => ({
  value: String(second),
  label: `:${padSeconds(second)}`,
}));

/**
 * Seconds pill for `DateRow`. SwiftUI's `DatePicker` has no seconds component
 * (`displayedComponents` is date and hourAndMinute, nothing finer), so the last
 * field of a timestamp has to be its own control — but it stays a *picker* like
 * the two pills beside it, not a keyboard field: a pull-down menu of the 60
 * values, with the current one checkmarked.
 *
 * The pill is ours because a menu Picker draws only its label; the height and
 * radius here are what put it on the same line as the date and time pills that
 * SwiftUI draws for itself.
 */
function SecondsPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (seconds: number) => void;
}) {
  return (
    <View style={styles.secondsPill}>
      <Segmented
        options={SECOND_OPTIONS}
        value={String(value)}
        onChange={(second) => onChange(Number(second))}
        variant="menu"
        // The menu's own 12pt label inset would sit inside the pill's padding
        // and read as double-indented; the pill owns the spacing instead.
        flush
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
export function DateRow({
  label,
  selection,
  displayedComponents,
  seconds,
  onDateChange,
}: {
  label: string;
  selection: Date;
  displayedComponents: ('date' | 'hourAndMinute')[];
  /** Adds the editable seconds pill — for timestamps recorded to the second. */
  seconds?: boolean;
  onDateChange: (date: Date) => void;
}) {
  /**
   * The picker reports whole minutes: the date it hands back carries `:00`,
   * so passing it straight through would wipe an imported fill's seconds the
   * moment anyone brushed the minute wheel. Re-stamp them from the value we
   * were given — only the seconds pill edits seconds.
   */
  const picked = (date: Date) => {
    if (!seconds) return onDateChange(date);
    const next = new Date(date);
    next.setSeconds(selection.getSeconds(), selection.getMilliseconds());
    onDateChange(next);
  };

  const setSeconds = (value: number) => {
    const next = new Date(selection);
    next.setSeconds(value, 0);
    onDateChange(next);
  };

  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel} numberOfLines={1}>
        {label}
      </Text>
      <View style={[styles.rowControl, styles.dateControl]}>
        {/*
          `ignoreSafeArea` is load-bearing: a hosted SwiftUI view still insets
          its content by the container safe area, so a picker sitting inside
          the home-indicator band — the dividend Date row, last card on the
          page — drew its pill ~20pt above its own frame, over the row divider.
          'all' also keeps the keyboard inset out of it while a field is open.
        */}
        <AppHost matchContents ignoreSafeArea="all">
          <DatePicker
            selection={selection}
            displayedComponents={displayedComponents}
            onDateChange={picked}
          />
        </AppHost>
        {seconds ? <SecondsPicker value={selection.getSeconds()} onChange={setSeconds} /> : null}
      </View>
    </View>
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
  // Full-width toggle row: label leads like a section header, the chevron
  // trails at the far edge — the iOS disclosure idiom.
  collapseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
  },
  collapsePressed: { opacity: 0.6 },
  collapseLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: theme.colors.mutedForeground,
  },
  collapseClip: { overflow: 'hidden' },
  // Absolute so the body measures its natural height inside the clip; the
  // top padding stands in for the column gap the header used to get.
  collapseInner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    gap: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
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
  rowInput: {
    flex: 1,
    textAlign: 'right',
    fontSize: 16,
    color: theme.colors.foreground,
    paddingVertical: theme.spacing.sm,
  },
  rowControl: { marginLeft: 'auto', flexShrink: 1 },
  /** Picker and seconds pill sit on one line, spaced like SwiftUI's own pills. */
  dateControl: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
  // Sized to the compact `DatePicker` pills either side of it: 34pt is the
  // app's control height (see `Segmented`'s `fill`), and the radius has to be
  // read against that height — the same 10pt on a text-hugging box looked
  // nearly capsule next to SwiftUI's squarer pills.
  secondsPill: {
    height: 34,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.input,
  },
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
}));
