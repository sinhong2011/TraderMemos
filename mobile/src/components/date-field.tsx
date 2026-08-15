import { DatePickerDialog, TimePickerDialog } from '@expo/ui/jetpack-compose';
import { useState } from 'react';
import { useUnistyles } from 'react-native-unistyles';

import { AppHost } from '@/components/app-host';
import { ControlPillButton } from '@/components/control-pill';
import type { DateFieldProps } from './date-field.types';

const pad2 = (value: number) => String(value).padStart(2, '0');

/**
 * Cross-platform form of the date/time control (`date-field.ios.tsx` keeps
 * the SwiftUI `DatePicker`; both export the same name, so the form rows never
 * branch). Compose has no *inline* compact picker — its `DateTimePicker` is
 * the full calendar — so the pill the rows are built around is drawn here and
 * a tap opens the Material dialog, which is how Android edits a date anyway.
 */
export function DateField({ selection, displayedComponents, onDateChange }: DateFieldProps) {
  const { theme } = useUnistyles();
  const [open, setOpen] = useState<'date' | 'time' | null>(null);

  /**
   * The dialogs hand back a Date built from their own fields alone, so each
   * pick merges over `selection`: the date dialog must not wipe the clock,
   * nor the time dialog the day (DateRow's re-stamping rule, kept here for
   * the platform where the row can't intercept it).
   */
  const picked = (date: Date) => {
    const next = new Date(selection);
    if (open === 'time') next.setHours(date.getHours(), date.getMinutes());
    else next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
    setOpen(null);
    onDateChange(next);
  };

  return (
    <>
      {displayedComponents.includes('date') ? (
        <ControlPillButton
          label={selection.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
          onPress={() => setOpen('date')}
        />
      ) : null}
      {displayedComponents.includes('hourAndMinute') ? (
        <ControlPillButton
          numeric
          label={`${pad2(selection.getHours())}:${pad2(selection.getMinutes())}`}
          onPress={() => setOpen('time')}
        />
      ) : null}
      {open != null ? (
        <AppHost matchContents>
          {open === 'date' ? (
            <DatePickerDialog
              initialDate={selection.toISOString()}
              color={theme.colors.primary}
              onDateSelected={picked}
              onDismissRequest={() => setOpen(null)}
            />
          ) : (
            <TimePickerDialog
              initialDate={selection.toISOString()}
              is24Hour
              color={theme.colors.primary}
              onDateSelected={picked}
              onDismissRequest={() => setOpen(null)}
            />
          )}
        </AppHost>
      ) : null}
    </>
  );
}
