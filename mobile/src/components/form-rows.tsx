import { Item } from 'panelui-native';
import { Children, Fragment, useState, type ReactNode } from 'react';
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useCSSVariable } from 'uniwind';

import { Icon } from '@/components/icon';
import { NumericField } from '@/components/numeric-field';
import { DateField } from '@/components/date-field';
import { TimePicker } from '@/components/time-picker';

/** The app's one spring (see symbol-pager-bar.tsx) — accordion motion matches. */
const ACCORDION_SPRING = { duration: 420, dampingRatio: 0.85 } as const;

/**
 * The inset-grouped row vocabulary shared by the creation sheets (trade form,
 * cash form) and the settings screens. Rows are label-leading with the control
 * pinned trailing — the grouped-list idiom both platforms share — drawn in JS
 * so a chip group, a pager or the screenshot queue can sit in a row beside a
 * plain text field.
 */

/** Muted uppercase grouped-section header. */
export function SectionHeader({ label }: { label: string }) {
  return (
    <Text className="mt-2 pl-4 text-xs font-semibold uppercase tracking-[0.6px] text-muted-foreground">
      {label}
    </Text>
  );
}

/** Grouped-list footer — the place for a rule the fields can't state. */
export function SectionFooter({ label }: { label: string }) {
  return (
    <Text className="-mt-2 px-4 text-xs leading-[17px] text-muted-foreground">{label}</Text>
  );
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
 * content snapping in. PanelUI's `Collapse` does the same job on a 200ms
 * timing curve — this keeps the hand-rolled one so the fold rides the app's
 * single spring, and so the chevron rotation can run off the same progress
 * value and always agree with it.
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
  const [mutedForeground] = useCSSVariable(['--color-muted-foreground']) as [string];
  const [open, setOpen] = useState(defaultOpen);
  const progress = useSharedValue(defaultOpen ? 1 : 0);
  // Written by onLayout directly (no spring): a late first measure or a chip
  // row reflowing must resize the open section instantly, not re-animate it.
  const contentHeight = useSharedValue(0);

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
      {/* Full-width toggle row: label leads like a section header, the chevron
          trails at the far edge — the disclosure idiom. */}
      <Pressable
        onPress={toggle}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        className="mt-2 flex-row items-center justify-between px-4 active:opacity-60"
      >
        <Text className="text-xs font-semibold uppercase tracking-[0.6px] text-muted-foreground">
          {label}
        </Text>
        <Animated.View style={chevron}>
          <Icon name="chevron.forward" size={11} weight="semibold" tintColor={mutedForeground} />
        </Animated.View>
      </Pressable>
      <Animated.View className="overflow-hidden" style={body} pointerEvents={open ? 'auto' : 'none'}>
        {/* Absolute so the body measures its natural height inside the clip;
            the top padding stands in for the column gap the header used to
            get. */}
        <View
          className="absolute left-0 right-0 top-0 gap-4 pt-4"
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

/** Inset-grouped card — children become rows split by inset hairlines. */
export function Card({ children }: { children: ReactNode }) {
  const rows = Children.toArray(children);
  return (
    <Item.Group className="overflow-hidden rounded-2xl bg-card" style={{ borderCurve: 'continuous' }}>
      {rows.map((row, index) => (
        <Fragment key={index}>
          {index > 0 ? <Item.Separator className="ml-4" /> : null}
          {row}
        </Fragment>
      ))}
    </Item.Group>
  );
}

/**
 * Settings-row idiom: label left, right-aligned input. `numeric` swaps in the
 * `NumericField` — a number field is its own control here, not a text field
 * wearing a numeric keyboard (see numeric-field.tsx).
 */
export function InputRow({
  label,
  numeric,
  decimals,
  onChangeText,
  ...props
}: { label: string; numeric?: boolean; decimals?: boolean } & TextInputProps) {
  const [mutedForeground] = useCSSVariable(['--color-muted-foreground']) as [string];
  return (
    <View className="min-h-12 flex-row items-center gap-3 px-4 py-1">
      <Text className="text-[15px] text-foreground">{label}</Text>
      {numeric ? (
        <NumericField
          align="trailing"
          value={props.value ?? ''}
          onChangeText={onChangeText ?? (() => {})}
          placeholder={props.placeholder}
          decimals={decimals}
          autoFocus={props.autoFocus}
        />
      ) : (
        <TextInput
          placeholderTextColor={mutedForeground}
          className="flex-1 py-2 text-right text-base text-foreground"
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
    <View className="min-h-12 flex-row items-center gap-3 px-4 py-1">
      <Text className="text-[15px] text-foreground">{label}</Text>
      <View className="ml-auto shrink">{children}</View>
    </View>
  );
}

/** Stacked label + full-width content (chip groups). */
export function StackRow({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <View className="gap-2 px-4 py-3">
      {label ? <Text className="text-[15px] text-foreground">{label}</Text> : null}
      {children}
    </View>
  );
}

/** Borderless multiline row — the notes-field idiom, no boxed input. */
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
  const [mutedForeground] = useCSSVariable(['--color-muted-foreground']) as [string];
  return (
    <View className="gap-2 px-4 py-3">
      <Text className="text-[15px] text-foreground">{label}</Text>
      <TextInput
        multiline
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={mutedForeground}
        className="min-h-14 p-0 text-base text-foreground"
        style={{ textAlignVertical: 'top' }}
      />
    </View>
  );
}

/**
 * Date/time row — same shape as every other row: the label leading, the
 * picker's pill(s) pinned trailing.
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
   * Stamps recorded to the second. The clock becomes a `TimePicker` — the
   * date control's own time pill stops at minutes — while the date half stays
   * that control's.
   */
  seconds?: boolean;
  onDateChange: (date: Date) => void;
}) {
  const ownsTime = seconds === true && displayedComponents.includes('hourAndMinute');
  // The date control keeps only the calendar; handing it `hourAndMinute` as
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
    <View className="min-h-12 flex-row items-center gap-3 px-4 py-1">
      <Text className="text-[15px] text-foreground" numberOfLines={1}>
        {label}
      </Text>
      {/* Date pill and clock pill share one line, spaced like a native pair. */}
      <View className="ml-auto shrink flex-row items-center gap-1">
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
