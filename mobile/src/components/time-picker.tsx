import { BottomSheet, Button, Group, HStack, Picker, Text as UIText } from '@expo/ui/swift-ui';
import {
  buttonStyle,
  foregroundStyle,
  frame,
  monospacedDigit,
  pickerStyle,
  presentationDragIndicator,
  tag,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';
import { useUnistyles } from 'react-native-unistyles';

import { AppHost } from '@/components/app-host';

/** Two digits, the way a clock writes them — 7 seconds past reads `07`. */
const pad2 = (value: number) => String(value).padStart(2, '0');

const column = (count: number) =>
  Array.from({ length: count }, (_, n) => ({ value: String(n), label: pad2(n) }));

const HOURS = column(24);
/** Minutes and seconds run the same 00–59, so one list serves both wheels. */
const SIXTY = column(60);

/** Three columns sized like a date picker's own wheels, not the sheet's width. */
const WHEEL_WIDTH = 76;
const WHEEL_HEIGHT = 180;

/**
 * The gray UIKit fills its own controls with — `tertiarySystemFill`, which is
 * what backs the compact `DatePicker` pill this one sits beside. A `.bordered`
 * button paints its fill from the tint at low opacity, so tinting with this
 * hue lands on the same gray in both schemes. Tinting with the foreground (the
 * first attempt) gave white at a heavier opacity, which read visibly lighter
 * than the date pill; the accent default paints it blue.
 */
const SYSTEM_FILL = '#767680';

/**
 * A clock, to the second, as one native control: a bordered pill reading
 * `HH:MM:SS` that opens hour / minute / second wheels in a sheet.
 *
 * This exists because SwiftUI's compact `DatePicker` cannot show seconds —
 * `displayedComponents` stops at `hourAndMinute` — so a to-the-second stamp
 * has to be assembled from parts. Everything here is still SwiftUI: the pill
 * is a `.bordered` `Button`, which is where its capsule and fill come from
 * rather than an imitation of the date picker's that has to be kept in sync.
 *
 * The wheels are a sheet and not a `.popover` because a popover always draws
 * an anchor arrow — SwiftUI exposes which edge it attaches to, never whether
 * it is drawn — and a wheel picker rising from the bottom is what iOS itself
 * does on a phone anyway.
 *
 * 24-hour, ignoring the 12/24h display pref, for the reason `fmtTimestamp`
 * gives: a to-the-second stamp is a fixed-width pattern, and AM/PM would be a
 * fourth wheel to fit.
 */
export function TimePicker({ value, onChange }: { value: Date; onChange: (next: Date) => void }) {
  const { theme } = useUnistyles();
  const [open, setOpen] = useState(false);

  const setPart = (part: 'hours' | 'minutes' | 'seconds', n: number) => {
    const next = new Date(value);
    if (part === 'hours') next.setHours(n);
    else if (part === 'minutes') next.setMinutes(n);
    // Milliseconds go with the seconds — a fill is stamped to the second, and
    // leaving a stale remainder makes two edits of the same value unequal.
    else next.setSeconds(n, 0);
    onChange(next);
  };

  const wheel = (
    options: readonly { value: string; label: string }[],
    selected: number,
    part: 'hours' | 'minutes' | 'seconds',
  ) => (
    <Picker
      selection={String(selected)}
      onSelectionChange={(selection) => {
        if (selection != null) setPart(part, Number(selection));
      }}
      modifiers={[pickerStyle('wheel'), frame({ width: WHEEL_WIDTH, height: WHEEL_HEIGHT })]}
    >
      {options.map((option) => (
        <UIText key={option.value} modifiers={[tag(option.value)]}>
          {option.label}
        </UIText>
      ))}
    </Picker>
  );

  return (
    <AppHost matchContents ignoreSafeArea="all">
      <BottomSheet
        isPresented={open}
        onIsPresentedChange={setOpen}
        // The detent follows the wheels' own height, so nothing here has to
        // guess a sheet size that a taller wheel would then break.
        fitToContents
        anchor={
          /* The label is a child rather than the `label` prop so it can carry
             its own color: a bordered button takes fill *and* label from the
             tint, and the two need different colors to match the date pill —
             system gray behind, plain foreground on top. */
          <Button
            onPress={() => setOpen(true)}
            modifiers={[buttonStyle('bordered'), tint(SYSTEM_FILL)]}
          >
            <UIText modifiers={[foregroundStyle(theme.colors.foreground), monospacedDigit()]}>
              {`${pad2(value.getHours())}:${pad2(value.getMinutes())}:${pad2(value.getSeconds())}`}
            </UIText>
          </Button>
        }
      >
        {/* Presentation modifiers have to sit on a wrapper the sheet owns,
            not on the wheels themselves. */}
        <Group modifiers={[presentationDragIndicator('visible')]}>
          <HStack spacing={0}>
            {wheel(HOURS, value.getHours(), 'hours')}
            {wheel(SIXTY, value.getMinutes(), 'minutes')}
            {wheel(SIXTY, value.getSeconds(), 'seconds')}
          </HStack>
        </Group>
      </BottomSheet>
    </AppHost>
  );
}
