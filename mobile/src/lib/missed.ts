import { t } from '@lingui/core/macro';

import type { MissedOutcome, MissedReason } from '@/api/types';
import type { FormPickerItem } from '@/components/form-kit';

type Plan = {
  direction: 'long' | 'short';
  /** `undefined` = typed but not a valid price; `null` = left empty. */
  entry: number | null | undefined;
  stop: number | null | undefined;
  target: number | null | undefined;
};

/** The API's plan rule, so the form can say what's wrong before saving. */
export function planProblem(plan: Plan): string | null {
  const prices = [plan.entry, plan.stop, plan.target];
  if (prices.some((p) => p === undefined || p === 0)) return t`Prices must be positive numbers.`;
  const { entry, stop, target } = plan;
  if (entry == null || stop == null || target == null) return null;
  if (plan.direction === 'long' && !(stop < entry && entry < target)) {
    return t`A long needs its stop below entry and its target above it.`;
  }
  if (plan.direction === 'short' && !(target < entry && entry < stop)) {
    return t`A short needs its stop above entry and its target below it.`;
  }
  return null;
}

/** Reward over risk for a full, coherent plan; null otherwise. */
export function plannedR(plan: Plan): number | null {
  const { entry, stop, target } = plan;
  if (entry == null || stop == null || target == null || planProblem(plan)) return null;
  return Math.abs(target - entry) / Math.abs(entry - stop);
}

export function missedReasons(): FormPickerItem<MissedReason>[] {
  return [
    { value: '', label: t`No reason given` },
    { value: 'hesitated', label: t`Hesitated` },
    { value: 'away', label: t`Away from screen` },
    { value: 'rules', label: t`Outside my rules` },
    { value: 'other', label: t`Other` },
  ];
}

export function missedOutcomes(): FormPickerItem<MissedOutcome>[] {
  return [
    { value: 'unknown', label: t`Not checked yet` },
    { value: 'target', label: t`Hit target` },
    { value: 'stop', label: t`Hit stop` },
    { value: 'no_trigger', label: t`Never triggered` },
  ];
}

export function reasonLabel(reason: string): string {
  return missedReasons().find((r) => r.value === reason)?.label ?? reason;
}

export function outcomeLabel(outcome: string): string {
  return missedOutcomes().find((o) => o.value === outcome)?.label ?? outcome;
}

/** Signed R, e.g. `+2.5R` / `-1R` / `0R`. */
export function fmtR(r: number): string {
  const abs = Math.abs(r);
  const s = Number.isInteger(abs) ? String(abs) : abs.toFixed(2).replace(/0$/, '');
  return `${r > 0 ? '+' : r < 0 ? '-' : ''}${s}R`;
}
