/**
 * Selected-account scope for the whole app. `null` means "All accounts" —
 * queries omit `account_id` and the API aggregates across accounts. Persisted
 * to MMKV so the scope survives relaunch; cleared on sign-out so the next user
 * never inherits it.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { storage } from '@/storage/mmkv';
import { adoptLegacyValue, mmkvStorage } from '@/storage/zustand-mmkv';

const PERSIST_KEY = 'store:selected-account';
/** Pre-zustand key: the raw id string, or absent for "All accounts". */
const LEGACY_KEY = 'prefs:selected-account';

type AccountState = { selectedAccountId: string | null };

adoptLegacyValue<AccountState>(PERSIST_KEY, [LEGACY_KEY], () => {
  const id = storage.getString(LEGACY_KEY);
  return id == null ? undefined : { selectedAccountId: id };
});

export const useAccountStore = create<AccountState>()(
  persist((): AccountState => ({ selectedAccountId: null }), {
    name: PERSIST_KEY,
    storage: mmkvStorage<AccountState>(),
  }),
);

export function setSelectedAccountId(id: string | null) {
  useAccountStore.setState({ selectedAccountId: id });
}

/** Sign-out hook — the scope belongs to the session that picked it. */
export function clearSelectedAccount() {
  setSelectedAccountId(null);
}

export function getSelectedAccountId(): string | null {
  return useAccountStore.getState().selectedAccountId;
}

export function useSelectedAccountId(): string | null {
  return useAccountStore((state) => state.selectedAccountId);
}
