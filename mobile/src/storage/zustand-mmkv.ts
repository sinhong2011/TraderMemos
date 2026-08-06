/**
 * MMKV backing for zustand's `persist` middleware.
 *
 * MMKV is synchronous, so `persist` rehydrates during `create()` — which is
 * what lets `getPrefs()` and friends be read at module scope by the money
 * formatters, outside React.
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

/** `storage` option for `persist` — no async wrapper, see above. */
export const mmkvStorage = <T>() => createJSONStorage<T>(() => mmkv);
