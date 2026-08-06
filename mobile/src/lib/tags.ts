import { t } from '@lingui/core/macro';

/** Kinds the API accepts (api/internal/api/tag_handlers.go). */
export const TAG_KINDS = [
  { value: 'custom', label: () => t`Custom` },
  { value: 'mistake', label: () => t`Mistake` },
] as const;

export function kindLabel(kind: string): string {
  return TAG_KINDS.find((option) => option.value === kind)?.label() ?? kind;
}

export const DEFAULT_TAG_COLOR = '#6366f1';

/**
 * One-tap palette for the tag sheet — hues that stay legible as a 10pt dot on
 * both schemes. The native color picker sits beside them and still takes any
 * hex, so this is a shortcut, not a constraint.
 */
export const TAG_SWATCHES = [
  '#6366f1',
  '#3b82f6',
  '#06b6d4',
  '#10b981',
  '#84cc16',
  '#f59e0b',
  '#f97316',
  '#ef4444',
  '#ec4899',
  '#a855f7',
] as const;
