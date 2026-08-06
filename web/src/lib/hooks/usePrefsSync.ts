import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { preferencesApi, type SyncedPrefs } from "@/lib/api/preferences";
import { useAuth } from "@/lib/auth";
import { useDisplayPrefs } from "@/lib/displayPrefs";
import { useJournalPrefs } from "@/lib/journalPrefs";
import {
  applyRemotePrefs,
  changedPrefs,
  localPrefsSnapshot,
  preferencesQueryKey,
  PREFS_PUSH_DELAY_MS,
  unseededPrefs,
} from "@/lib/prefsSync";

/**
 * Keeps the account-level preferences in step with the server.
 *
 * Pull on sign-in, push on change. The first device to sign in seeds whatever
 * the account has never stored, so an existing local setup is adopted rather
 * than reset to defaults — after that the server is the source of truth and
 * wins on load.
 *
 * Mounted once, from the authenticated shell. A failed push is left to
 * TanStack's retry and then dropped: losing a preference write is a
 * preference, not data, and the local store still has the value.
 */
export function usePrefsSync() {
  const authed = useAuth((s) => s.authed);
  // Set while server values are being written into the stores, so the
  // subscription below doesn't mistake them for a local edit and echo them
  // straight back.
  const applying = useRef(false);
  const lastSynced = useRef<SyncedPrefs | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const remote = useQuery({
    queryKey: preferencesQueryKey,
    queryFn: () => preferencesApi.get(),
    enabled: authed,
    staleTime: 5 * 60_000,
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
      void preferencesApi.patch(seed).catch(() => {});
    }
  }, [remotePrefs]);

  // Signing out has to drop the baseline: the next account's first pull must
  // look like a fresh one, not a diff against someone else's preferences.
  useEffect(() => {
    if (!authed) lastSynced.current = null;
  }, [authed]);

  useEffect(() => {
    if (!authed) return;

    function push() {
      if (applying.current || lastSynced.current == null) return;
      const next = localPrefsSnapshot();
      const patch = changedPrefs(lastSynced.current, next);
      if (Object.keys(patch).length === 0) return;
      lastSynced.current = next;
      void preferencesApi.patch(patch).catch(() => {});
    }

    function schedule() {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(push, PREFS_PUSH_DELAY_MS);
    }

    const unsubs = [useDisplayPrefs.subscribe(schedule), useJournalPrefs.subscribe(schedule)];
    return () => {
      if (timer.current) clearTimeout(timer.current);
      for (const off of unsubs) off();
    };
  }, [authed]);
}
