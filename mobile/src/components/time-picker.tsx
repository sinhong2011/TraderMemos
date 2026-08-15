import { Button, TimePicker as PanelTimePicker, type TimeValue } from 'panelui-native';

/** Two digits, the way a clock writes them — 7 seconds past reads `07`. */
const pad2 = (value: number) => String(value).padStart(2, '0');

/**
 * A clock to the second: a pill reading `HH:MM:SS` that opens hour/minute
 * wheels in a sheet.
 *
 * It exists as its own control because the row's `DateField` stops at the
 * minute, and a to-the-second stamp (an imported fill) has to keep the
 * seconds it arrived with. No wheel edits them — no picker on either platform
 * has ever offered one — so they *ride through* every pick unchanged, which is
 * what keeps re-saving an imported fill a no-op rather than a truncation.
 *
 * 24-hour, ignoring the 12/24h display pref, for the reason `fmtTimestamp`
 * gives: a to-the-second stamp is a fixed-width pattern, and AM/PM would be a
 * fourth column to fit.
 */
export function TimePicker({ value, onChange }: { value: Date; onChange: (next: Date) => void }) {
  // Merge over `value`: the picker's answer is built from its own two columns
  // alone, and the day and the seconds belong to the caller, not to it.
  const picked = ({ hour, minute }: TimeValue) => {
    const next = new Date(value);
    next.setHours(hour, minute);
    onChange(next);
  };

  return (
    <PanelTimePicker
      value={{ hour: value.getHours(), minute: value.getMinutes() }}
      onValueChange={picked}
      hourCycle={24}
      presentation="bottom-sheet"
    >
      <Button variant="secondary" size="sm" labelClassName="tabular-nums">
        {`${pad2(value.getHours())}:${pad2(value.getMinutes())}:${pad2(value.getSeconds())}`}
      </Button>
    </PanelTimePicker>
  );
}
