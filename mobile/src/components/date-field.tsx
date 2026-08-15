import { Button, DatePicker, TimePicker, type TimeValue } from 'panelui-native';

/** Props of the date/time control the form rows are built around. */
export type DateFieldProps = {
  /** Wall-clock value the control reflects; picks merge into it. */
  selection: Date;
  /** Which pills to draw. */
  displayedComponents: ('date' | 'hourAndMinute')[];
  onDateChange: (date: Date) => void;
};

/** Two digits, the way a clock writes them — 7 minutes past reads `07`. */
const pad2 = (value: number) => String(value).padStart(2, '0');

/**
 * The compact date/time control: a pill per component, each opening its own
 * PanelUI picker in a bottom sheet.
 *
 * One JS-drawn implementation for both platforms — it used to be a SwiftUI
 * `DatePicker` on iOS and Material dialogs on Android, which is why the pills
 * are the shape they are: neither platform's inline picker fits a settings-row
 * trailing slot, and a pill that opens a picker is what both do anyway.
 *
 * A sheet rather than an anchored popover because these rows live in forms
 * with the keyboard up, where a panel anchored to a row halfway down the page
 * has nowhere to go.
 *
 * The pickers hand back a value built from their own fields alone, so each
 * pick merges over `selection`: the calendar must not wipe the clock, nor the
 * clock the day (`DateRow` states the same rule for the rows that split the
 * two halves across two controls).
 *
 * 24-hour, ignoring the 12/24h display pref, for the reason `fmtTimestamp`
 * gives: an edit field is a fixed-width pattern, and AM/PM would be a third
 * column to fit.
 */
export function DateField({ selection, displayedComponents, onDateChange }: DateFieldProps) {
  const pickDay = (day: Date | undefined) => {
    if (!day) return;
    const next = new Date(selection);
    next.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
    onDateChange(next);
  };

  const pickTime = ({ hour, minute }: TimeValue) => {
    const next = new Date(selection);
    next.setHours(hour, minute);
    onDateChange(next);
  };

  return (
    <>
      {displayedComponents.includes('date') ? (
        <DatePicker selected={selection} onSelect={pickDay} presentation="bottom-sheet">
          <Button variant="secondary" size="sm">
            {selection.toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </Button>
        </DatePicker>
      ) : null}
      {displayedComponents.includes('hourAndMinute') ? (
        <TimePicker
          value={{ hour: selection.getHours(), minute: selection.getMinutes() }}
          onValueChange={pickTime}
          hourCycle={24}
          presentation="bottom-sheet"
        >
          <Button variant="secondary" size="sm" labelClassName="tabular-nums">
            {`${pad2(selection.getHours())}:${pad2(selection.getMinutes())}`}
          </Button>
        </TimePicker>
      ) : null}
    </>
  );
}
