/**
 * Economic-calendar filters (impact, currency), persisted so the trader who
 * only ever watches high-impact USD doesn't rebuild that selection on every
 * visit. MMKV-backed module store (reports-display.ts pattern) because the
 * nav-bar filter menu and the screen live in different subtrees.
 */

import { useSyncExternalStore } from 'react';

import { storage } from '@/storage/mmkv';

export type EventFilters = {
  /** Empty means "all" for both — the menu shows nothing checked. */
  impacts: string[];
  currencies: string[];
};

const EMPTY: EventFilters = { impacts: [], currencies: [] };

const STORAGE_KEY = 'events:filters';

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function load(): EventFilters {
  const raw = storage.getString(STORAGE_KEY);
  if (!raw) return EMPTY;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return { impacts: strings(parsed.impacts), currencies: strings(parsed.currencies) };
  } catch {
    return EMPTY;
  }
}

let snapshot: EventFilters = load();
const listeners = new Set<() => void>();

function publish(next: EventFilters) {
  snapshot = next;
  storage.set(STORAGE_KEY, JSON.stringify(next));
  for (const listener of listeners) listener();
}

/** Add or remove one value from a dimension. */
export function toggleEventFilter(dimension: keyof EventFilters, value: string) {
  const current = snapshot[dimension];
  publish({
    ...snapshot,
    [dimension]: current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value],
  });
}

export function clearEventFilters() {
  publish(EMPTY);
}

export function useEventFilters(): EventFilters {
  return useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    () => snapshot,
  );
}
