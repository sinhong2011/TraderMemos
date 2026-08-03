/**
 * App-wide MMKV store and the TanStack Query persister built on it.
 *
 * Persisting the query cache gives cold starts instant last-known data and
 * keeps dashboards/lists readable offline. The server stays the source of
 * truth — this is a read cache, not an offline database. Tokens live in
 * expo-secure-store, never here.
 */
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { createMMKV } from 'react-native-mmkv';

export const storage = createMMKV({ id: 'tradermemos' });

const QUERY_CACHE_KEY = 'tanstack-query-cache';

export const queryPersister = createSyncStoragePersister({
  key: QUERY_CACHE_KEY,
  storage: {
    getItem: (key) => storage.getString(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => {
      storage.remove(key);
    },
  },
});

/** Drop the persisted snapshot (used on sign-out alongside queryClient.clear()). */
export function clearPersistedQueryCache() {
  storage.remove(QUERY_CACHE_KEY);
}
