import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { useApiRequest } from '@/api/hooks';
import { useSession } from '@/api/session';
import { subscribeJournalPrefs } from '@/lib/journal-prefs';
import { subscribeDisplayPrefs } from '@/lib/prefs';
import {
  applyRemotePrefs,
  changedPrefs,
  localPrefsSnapshot,
  PREFS_PUSH_DELAY_MS,
  unseededPrefs,
  type PreferencesResponse,
  type SyncedPrefs,
} from '@/lib/prefs-sync';

export const preferencesQueryKey = ['me', 'preferences'] as const;

/**
 * Keeps the account-level preferences in step with the server: pull on
 * sign-in, push on change.
 *
 * The first device to sign in seeds whatever the account has never stored, so
 * a phone that was set up before this existed keeps its clock and timezones
 * instead of being reset by an empty account. After that the server wins on
 * load.
 *
 * Mounted once, from the root layout. Pushes are best-effort — the value is
 * already in MMKV, and a preference that fails to reach the server is a
 * preference, not data.
 */
export function usePrefsSync() {
  const { session } = useSession();
  const api = useApiRequest();
  // Set while server values are written into the stores, so the subscription
  // below doesn't mistake them for a local edit and echo them back.
  const applying = useRef(false);
  const lastSynced = useRef<SyncedPrefs | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const remote = useQuery({
    queryKey: preferencesQueryKey,
    enabled: session != null,
    staleTime: 5 * 60_000,
    queryFn: () => api<PreferencesResponse>('/me/preferences'),
  });

  const remotePrefs = remote.data?.prefs;

  useEffect(() => {
    if (!remotePrefs) return;
    applying.current = true;
    applyRemotePrefs(remotePrefs);
    applying.current = false;

    const local = localPrefsSnapshot();
    lastSynced.current = local;

    const seed = unseededPrefs(remotePrefs, local);
    if (Object.keys(seed).length > 0) {
      void api('/me/preferences', { method: 'PATCH', body: seed }).catch(() => {});
    }
  }, [api, remotePrefs]);

  // Signing out drops the baseline: the next account's first pull has to look
  // like a fresh one, not a diff against someone else's preferences.
  useEffect(() => {
    if (session == null) lastSynced.current = null;
  }, [session]);

  useEffect(() => {
    if (session == null) return;

    function push() {
      if (applying.current || lastSynced.current == null) return;
      const next = localPrefsSnapshot();
      const patch = changedPrefs(lastSynced.current, next);
      if (Object.keys(patch).length === 0) return;
      lastSynced.current = next;
      void api('/me/preferences', { method: 'PATCH', body: patch }).catch(() => {});
    }

    function schedule() {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(push, PREFS_PUSH_DELAY_MS);
    }

    const unsubs = [subscribeDisplayPrefs(schedule), subscribeJournalPrefs(schedule)];
    return () => {
      if (timer.current) clearTimeout(timer.current);
      for (const off of unsubs) off();
    };
  }, [api, session]);
}
