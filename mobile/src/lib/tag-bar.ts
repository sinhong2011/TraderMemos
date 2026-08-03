/**
 * Session-scoped store for the trades quick-filter chip bar. The manage sheet
 * picks chips from the journal taxonomies: tags are shown by default (hide by
 * id), while setup / emotion / rating chips are opt-in extras. Module-level so
 * the sheet route and the trades screen share it without a provider.
 *
 * Chip keys: `tag:<id>` | `setup:<id>` | `emotion:<name>` | `sgrade:<1-5>` |
 * `egrade:<1-5>` — parsed by the trades screen's chip matcher.
 */

import { useSyncExternalStore } from 'react';

export type ExtraChip = { key: string; label: string };

type TagBarState = { hiddenTagIds: string[]; extras: ExtraChip[] };

let hiddenTags = new Set<string>();
let extras = new Map<string, string>();
let snapshot: TagBarState = { hiddenTagIds: [], extras: [] };
const listeners = new Set<() => void>();

function emit() {
  snapshot = {
    hiddenTagIds: [...hiddenTags],
    extras: [...extras].map(([key, label]) => ({ key, label })),
  };
  for (const listener of listeners) listener();
}

export function toggleTagHidden(id: string) {
  if (hiddenTags.has(id)) hiddenTags.delete(id);
  else hiddenTags.add(id);
  emit();
}

export function toggleExtraChip(key: string, label: string) {
  if (extras.has(key)) extras.delete(key);
  else extras.set(key, label);
  emit();
}

export function useTagBarState(): TagBarState {
  return useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    () => snapshot,
  );
}
