import { Children, Fragment, useState, type ReactNode } from 'react';
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Icon } from '@/components/icon';
import { NumericField } from '@/components/numeric-field';
import { DateField } from '@/components/date-field';
import { TimePicker } from '@/components/time-picker';

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
          <Icon
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
  /**
   * Stamps recorded to the second. The clock becomes a `TimePicker` — SwiftUI's
   * own time pill stops at minutes — while the date half stays this picker's.
   */
  seconds?: boolean;
  onDateChange: (date: Date) => void;
}) {
  const ownsTime = seconds === true && displayedComponents.includes('hourAndMinute');
  // The date picker keeps only the calendar; handing it `hourAndMinute` as
  // well would draw a second, minute-only clock beside the TimePicker.
  const pickerComponents = ownsTime
    ? displayedComponents.filter((component) => component !== 'hourAndMinute')
    : displayedComponents;

  /**
   * The calendar reports midnight: the value it hands back has no clock, so
   * passing it straight through would wipe an imported fill's time the moment
   * anyone changed the day. Re-stamp it from the value we were given — only
   * the `TimePicker` edits the clock.
   */
  const picked = (date: Date) => {
    if (!ownsTime) return onDateChange(date);
    const next = new Date(date);
    next.setHours(
      selection.getHours(),
      selection.getMinutes(),
      selection.getSeconds(),
      selection.getMilliseconds(),
    );
    onDateChange(next);
  };

  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel} numberOfLines={1}>
        {label}
      </Text>
      <View style={[styles.rowControl, styles.dateControl]}>
        {pickerComponents.length > 0 ? (
          <DateField
            selection={selection}
            displayedComponents={pickerComponents}
            onDateChange={picked}
          />
        ) : null}
        {ownsTime ? <TimePicker value={selection} onChange={onDateChange} /> : null}
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
  /** Date pill and clock pill share one line, spaced like SwiftUI's own pair. */
  dateControl: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
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
