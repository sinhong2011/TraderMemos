/**
 * Session-scoped store for the trades quick-filter chip bar. The manage sheet
 * picks chips from the journal taxonomies: tags are shown by default (hide by
 * id), while setup / emotion / rating chips are opt-in extras. A store, not
 * screen state, so the sheet route and the trades screen share it without a
 * provider — and deliberately unpersisted: the bar is a per-session lens.
 *
 * Chip keys: `tag:<id>` | `setup:<id>` | `emotion:<name>` | `sgrade:<1-5>` |
 * `egrade:<1-5>` — parsed by the trades screen's chip matcher.
 */

import { create } from 'zustand';

export type ExtraChip = { key: string; label: string };

type TagBarState = { hiddenTagIds: string[]; extras: ExtraChip[] };

const useTagBarStore = create<TagBarState>()((): TagBarState => ({
  hiddenTagIds: [],
  extras: [],
}));

export function toggleTagHidden(id: string) {
  useTagBarStore.setState((state) => ({
    hiddenTagIds: state.hiddenTagIds.includes(id)
      ? state.hiddenTagIds.filter((item) => item !== id)
      : [...state.hiddenTagIds, id],
  }));
}

export function toggleExtraChip(key: string, label: string) {
  useTagBarStore.setState((state) => ({
    // Append rather than re-key: the bar renders in pick order.
    extras: state.extras.some((chip) => chip.key === key)
      ? state.extras.filter((chip) => chip.key !== key)
      : [...state.extras, { key, label }],
  }));
}

export function useTagBarState(): TagBarState {
  return useTagBarStore();
}
