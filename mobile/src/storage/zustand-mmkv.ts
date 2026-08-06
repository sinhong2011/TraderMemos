/**
 * MMKV backing for zustand's `persist` middleware, plus the one-time lift of
 * the hand-rolled stores' data into it.
 *
 * Before this, every module store owned its own `storage.getString` /
 * `storage.set` pair and wrote a bare value under its own key. `persist` wraps
 * state in a `{ state, version }` envelope, so pointing it at those keys would
 * read a bare blob, fail to find `.state`, and silently fall back to initial
 * state — every user's timezone, account scope and saved calculator sessions
 * would reset on upgrade. `adoptLegacyValue` re-wraps the old value once, then
 * drops the old key.
 */
import { createJSONStorage, type StateStorage } from 'zustand/middleware';

import { storage } from './mmkv';

const mmkv: StateStorage = {
  getItem: (name) => storage.getString(name) ?? null,
  setItem: (name, value) => storage.set(name, value),
  removeItem: (name) => {
    storage.remove(name);
  },
};

/** `storage` option for `persist` — MMKV is synchronous, so no async wrapper. */
export const mmkvStorage = <T>() => createJSONStorage<T>(() => mmkv);

/**
 * Seed a persist key from a pre-zustand MMKV entry, once.
 *
 * `read` pulls the legacy value in its original type (string / boolean / JSON
 * blob) and returns the partial state it maps to, or `undefined` when there is
 * nothing stored. Call before `create()` so the store's first read already
 * sees the envelope.
 *
 * REMOVABLE once no install can still be carrying pre-0.4.3 keys — see the
 * checklist in `lib/prefs-migration.ts`. This only serves upgrades *across*
 * 0.4.3; it is inert on every launch after the first.
 */
export function adoptLegacyValue<T>(
  persistKey: string,
  legacyKeys: string[],
  read: () => T | undefined,
  version = 0,
): void {
  // Already migrated (or already written by this version) — never clobber.
  if (storage.getString(persistKey) != null) return;
  let state: T | undefined;
  try {
    state = read();
  } catch {
    state = undefined;
  }
  if (state !== undefined) {
    storage.set(persistKey, JSON.stringify({ state, version }));
  }
  for (const key of legacyKeys) storage.remove(key);
}

/** Legacy helper: parse a JSON blob written by an old module store. */
export function legacyJSON(key: string): unknown {
  const raw = storage.getString(key);
  if (raw == null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}
