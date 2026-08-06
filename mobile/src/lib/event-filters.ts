/**
 * Economic-calendar filters (impact, currency), persisted so the trader who
 * only ever watches high-impact USD doesn't rebuild that selection on every
 * visit. A store rather than screen state because the nav-bar filter menu and
 * the screen live in different subtrees.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { adoptLegacyValue, legacyJSON, mmkvStorage } from '@/storage/zustand-mmkv';

export type EventFilters = {
  /** Empty means "all" for both — the menu shows nothing checked. */
  impacts: string[];
  currencies: string[];
};

const EMPTY: EventFilters = { impacts: [], currencies: [] };

const PERSIST_KEY = 'store:event-filters';
/** Pre-zustand key. Removable — see lib/prefs-migration.ts. */
const LEGACY_KEY = 'events:filters';

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

adoptLegacyValue<EventFilters>(PERSIST_KEY, [LEGACY_KEY], () => {
  const parsed = legacyJSON(LEGACY_KEY) as Record<string, unknown> | undefined;
  if (parsed == null) return undefined;
  return { impacts: strings(parsed.impacts), currencies: strings(parsed.currencies) };
});

const useEventFilterStore = create<EventFilters>()(
  persist((): EventFilters => EMPTY, {
    name: PERSIST_KEY,
    storage: mmkvStorage<EventFilters>(),
    // A hand-edited or half-written blob must not wedge the filter menu.
    merge: (persisted, current) => {
      const raw = (persisted ?? {}) as Record<string, unknown>;
      return { ...current, impacts: strings(raw.impacts), currencies: strings(raw.currencies) };
    },
  }),
);

/** Add or remove one value from a dimension. */
export function toggleEventFilter(dimension: keyof EventFilters, value: string) {
  const current = useEventFilterStore.getState()[dimension];
  useEventFilterStore.setState({
    [dimension]: current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value],
  } as Partial<EventFilters>);
}

export function clearEventFilters() {
  useEventFilterStore.setState(EMPTY);
}

export function useEventFilters(): EventFilters {
  return useEventFilterStore();
}
