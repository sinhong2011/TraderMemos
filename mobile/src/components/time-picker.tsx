import { TimePickerDialog } from '@expo/ui/jetpack-compose';
import { useState } from 'react';
import { useUnistyles } from 'react-native-unistyles';

import { AppHost } from '@/components/app-host';
import { ControlPillButton } from '@/components/control-pill';

/** Two digits, the way a clock writes them — 7 seconds past reads `07`. */
const pad2 = (value: number) => String(value).padStart(2, '0');

/**
 * Cross-platform form of the seconds clock (`time-picker.ios.tsx` keeps the
 * SwiftUI wheels; both export the same name, so `DateRow` never branches).
 *
 * Material has no seconds control anywhere — the M3 time picker stops at
 * minutes — so the pill still *shows* `HH:MM:SS` while the dialog edits only
 * the hour and minute; the seconds ride through unchanged, which keeps an
 * imported fill's to-the-second stamp intact. 24-hour for the reason the iOS
 * file gives: a to-the-second stamp is a fixed-width pattern.
 */
export function TimePicker({ value, onChange }: { value: Date; onChange: (next: Date) => void }) {
  const { theme } = useUnistyles();
  const [open, setOpen] = useState(false);

  const picked = (date: Date) => {
    // Merge over `value`: the dialog's Date is built from its own fields
    // alone, and the day and the seconds belong to the row, not this dialog.
    const next = new Date(value);
    next.setHours(date.getHours(), date.getMinutes());
    setOpen(false);
    onChange(next);
  };

  return (
    <>
      <ControlPillButton
        numeric
        label={`${pad2(value.getHours())}:${pad2(value.getMinutes())}:${pad2(value.getSeconds())}`}
        onPress={() => setOpen(true)}
      />
      {open ? (
        <AppHost matchContents>
          <TimePickerDialog
            initialDate={value.toISOString()}
            is24Hour
            color={theme.colors.primary}
            onDateSelected={picked}
            onDismissRequest={() => setOpen(false)}
          />
        </AppHost>
      ) : null}
    </>
  );
}
