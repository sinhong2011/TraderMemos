import { t } from '@lingui/core/macro';
import { Button, Popover } from 'panelui-native';
import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { COLUMN_HEIGHT, ROW_HEIGHT, WheelColumn } from '@/components/wheel-column';

/** Two digits, the way a clock writes them — 7 seconds past reads `07`. */
const pad2 = (value: number) => String(value).padStart(2, '0');

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const SIXTY = Array.from({ length: 60 }, (_, i) => i);

/**
 * A clock to the second: a pill reading `HH:MM:SS` that opens hour, minute
 * *and* second wheels in a sheet.
 *
 * It exists as its own control because the row's `DateField` stops at the
 * minute, and a to-the-second stamp (an imported fill) is sequenced by its
 * seconds — the server replays a trade's executions in `executed_at, id`
 * order. PanelUI's `TimePicker` cannot draw the third column (`TimeValue` is
 * `{hour, minute}`), so this composes the same wheel — `WheelColumn`, the
 * library's own column extracted — inside the same bottom-sheet shell the
 * library uses (`Popover` presented from the bottom edge, `Popover.Close`
 * around a full-width Done).
 *
 * 24-hour, ignoring the 12/24h display pref, for the reason `fmtTimestamp`
 * gives: a to-the-second stamp is a fixed-width pattern, and AM/PM would be a
 * fourth column to fit.
 */
export function TimePicker({ value, onChange }: { value: Date; onChange: (next: Date) => void }) {
  // Merge over `value`: each column's answer is its own field alone, and the
  // day belongs to the caller, not to the clock.
  const setPart = (part: 'hour' | 'minute' | 'second') => (index: number) => {
    const next = new Date(value);
    if (part === 'hour') next.setHours(index);
    if (part === 'minute') next.setMinutes(index);
    if (part === 'second') next.setSeconds(index);
    onChange(next);
  };

  const columns = useMemo(
    () =>
      [
        { part: 'hour', items: HOURS, index: value.getHours(), label: t`Hour` },
        { part: 'minute', items: SIXTY, index: value.getMinutes(), label: t`Minute` },
        { part: 'second', items: SIXTY, index: value.getSeconds(), label: t`Second` },
      ] as const,
    [value],
  );

  return (
    <Popover presentation="bottom-sheet">
      <Popover.Trigger>
        <Button variant="secondary" size="sm" labelClassName="tabular-nums">
          {`${pad2(value.getHours())}:${pad2(value.getMinutes())}:${pad2(value.getSeconds())}`}
        </Button>
      </Popover.Trigger>
      <Popover.Content width="full">
        <View className="gap-3">
          {/* One caption per column, on the same flex grid as the wheels —
              three bare number columns give no clue which is which. */}
          <View className="flex-row">
            {columns.map((column) => (
              <Text
                key={column.part}
                className="flex-1 text-center text-xs font-semibold uppercase tracking-[0.6px] text-muted-foreground"
              >
                {column.label}
              </Text>
            ))}
          </View>
          <View
            className="relative flex-row items-stretch justify-center"
            style={{ height: COLUMN_HEIGHT }}
          >
            {/* Behind the columns, and the only thing marking the selection —
                so it stays exactly one row tall however many columns there
                happen to be. */}
            <View
              pointerEvents="none"
              className="absolute inset-x-0 rounded-xl bg-muted"
              style={{ top: (COLUMN_HEIGHT - ROW_HEIGHT) / 2, height: ROW_HEIGHT }}
            />
            {columns.map((column) => (
              <WheelColumn
                key={column.part}
                items={column.items}
                index={column.index}
                onIndexChange={setPart(column.part)}
                label={pad2}
                accessibilityLabel={column.label}
                className="flex-1"
              />
            ))}
          </View>
          {/* The sheet's outside is only the strip above it — a picker whose
              wheels are under your thumb needs somewhere deliberate to finish. */}
          <Popover.Close>
            <Button className="w-full">{t`Done`}</Button>
          </Popover.Close>
        </View>
      </Popover.Content>
    </Popover>
  );
}
