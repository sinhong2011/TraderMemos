import { DatePicker, Host } from '@expo/ui/swift-ui';
import { Children, Fragment, type ReactNode } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { NumericField } from '@/components/numeric-field';

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
}));
