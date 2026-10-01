import { t } from '@lingui/core/macro';

import type { RoutineStage } from '@/api/types';

/** Stages in the order a session runs. */
export const STAGES: RoutineStage[] = ['pre', 'during', 'post'];

export function stageLabel(stage: RoutineStage): string {
  switch (stage) {
    case 'pre':
      return t`Before trading`;
    case 'during':
      return t`During trading`;
    default:
      return t`After trading`;
  }
}

/** `day` (YYYY-MM-DD) shifted by n calendar days on the device clock. */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, (m ?? 1) - 1, (d ?? 1) + n);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

/** Monday of the week twelve weeks before `today`'s: 13 whole-week columns. */
export function historyStart(today: string): string {
  const [y, m, d] = today.split('-').map(Number);
  const sinceMonday = (new Date(y, (m ?? 1) - 1, d ?? 1).getDay() + 6) % 7;
  return addDays(today, -sinceMonday - 7 * 12);
}

/** Picker order: the trading week first. */
export const PICKER_DAYS = [1, 2, 3, 4, 5, 6, 0];

export const MON_TO_FRI = [1, 2, 3, 4, 5];

/** Short weekday name on the device locale (0 = Sunday). */
export function weekdayShort(day: number): string {
  // 2026-09-27 is a Sunday.
  return new Date(2026, 8, 27 + day).toLocaleDateString(undefined, { weekday: 'short' });
}

/** "Every day", "Weekdays", "Weekends", or the listed days, Monday first. */
export function weekdaysLabel(days: number[]): string {
  const set = new Set(days);
  if (set.size === 7) return t`Every day`;
  if (set.size === 5 && MON_TO_FRI.every((d) => set.has(d))) return t`Weekdays`;
  if (set.size === 2 && set.has(0) && set.has(6)) return t`Weekends`;
  return PICKER_DAYS.filter((d) => set.has(d))
    .map(weekdayShort)
    .join(', ');
}
