/**
 * Custom date range — a two-tap span on a real calendar.
 *
 * The date filter's presets ("This month", "Last 30 days") answer the common
 * questions and none of the specific ones: the week you were testing a setup,
 * the fortnight before a drawdown. This is the escape hatch, and a month grid
 * is the right shape for it — a span is defined by where it starts and where
 * it stops, which a list of days cannot show and a calendar draws directly.
 *
 * Applying is deliberate rather than on the second tap: the first tap of a new
 * span looks identical to a mis-tap on a finished one, so committing as soon
 * as an end lands would make correcting a slip impossible.
 */
import { BottomSheet, Calendar, cn, type DateRange } from 'panelui-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { t } from '@lingui/core/macro';
import { locale } from '@/i18n';
import { useFormatters } from '@/lib/format';

/** `YYYY-MM-DD`, read off the local fields the calendar counts in. */
export function dayKeyOf(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** A day key back to the local midnight the calendar wants to draw selected. */
function dateOf(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export type DayRange = { from: string; to: string };

export function DateRangeSheet({
  open,
  onOpenChange,
  value,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The range in force, so reopening lands on it rather than on today. */
  value: DayRange | null;
  onApply: (range: DayRange) => void;
}) {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheet.Content>
        <BottomSheet.Header title={t`Custom range`} />
        {/*
          * Keyed on the visit and on what is in force, so each opening starts
          * from the applied span rather than from the half-drawn one an
          * earlier visit was abandoned on. A remount says that; an effect
          * writing state back would say it a render too late.
          */}
        <RangeBody
          key={`${open}:${value?.from ?? ''}:${value?.to ?? ''}`}
          value={value}
          onApply={onApply}
        />
      </BottomSheet.Content>
    </BottomSheet>
  );
}

/**
 * `onApply` is the whole handoff — closing is the caller's to do, and doing it
 * from here as a second call made the sheet report a dismissal the caller
 * could not tell apart from the user walking away.
 */
function RangeBody({
  value,
  onApply,
}: {
  value: DayRange | null;
  onApply: (range: DayRange) => void;
}) {
  const { formatDayKey } = useFormatters();
  const [range, setRange] = useState<DateRange | undefined>(() =>
    value ? { from: dateOf(value.from), to: dateOf(value.to) } : undefined,
  );

  // A single tap is a single day, which is a legitimate span — the second tap
  // is how you widen it, not how you make it valid.
  const from = range?.from;
  const to = range?.to ?? range?.from;
  const ready = from != null && to != null;
  const summary = !ready
    ? t`Pick a start and an end`
    : from.getTime() === to.getTime()
      ? formatDayKey(dayKeyOf(from))
      : `${formatDayKey(dayKeyOf(from))} – ${formatDayKey(dayKeyOf(to))}`;

  return (
    <>
      <Calendar
        mode="range"
        bordered={false}
        captionLayout="dropdown"
        locale={locale}
        selected={range}
        onSelect={setRange}
      />
      <View className="flex-row items-center justify-between gap-3 pt-1">
        <Text
          className={cn(
            'flex-1 text-[15px] tabular-nums',
            ready ? 'text-foreground' : 'text-muted-foreground',
          )}
          numberOfLines={1}
        >
          {summary}
        </Text>
        <Pressable
          disabled={!ready}
          onPress={() => {
            if (!ready) return;
            onApply({ from: dayKeyOf(from), to: dayKeyOf(to) });
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityState={{ disabled: !ready }}
          className={cn(
            'rounded-md px-3 py-1.5 active:opacity-60',
            ready ? 'bg-primary' : 'bg-muted',
          )}
        >
          <Text
            className={cn(
              'text-[15px] font-semibold',
              ready ? 'text-primary-foreground' : 'text-muted-foreground',
            )}
          >
            {t`Apply`}
          </Text>
        </Pressable>
      </View>
    </>
  );
}
