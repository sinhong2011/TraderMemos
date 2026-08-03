/**
 * Selected-account scope for the whole app. `null` means "All accounts" —
 * queries omit `account_id` and the API aggregates across accounts. Module
 * store (tag-bar.ts pattern) persisted to MMKV so the scope survives relaunch;
 * cleared on sign-out so the next user never inherits it.
 */

import { useSyncExternalStore } from 'react';

import { storage } from '@/storage/mmkv';

const STORAGE_KEY = 'prefs:selected-account';

let selectedAccountId: string | null = storage.getString(STORAGE_KEY) ?? null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function setSelectedAccountId(id: string | null) {
  selectedAccountId = id;
  if (id == null) storage.remove(STORAGE_KEY);
  else storage.set(STORAGE_KEY, id);
  emit();
}

/** Sign-out hook — the scope belongs to the session that picked it. */
export function clearSelectedAccount() {
  setSelectedAccountId(null);
}

export function getSelectedAccountId(): string | null {
  return selectedAccountId;
}

export function useSelectedAccountId(): string | null {
  return useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    () => selectedAccountId,
  );
}
