/**
 * Change the API server from inside the app — previously the URL was only
 * editable on the sign-in screen, so a moved or renumbered server stranded a
 * signed-in session with no way out but Sign out (and nothing told you that
 * was the fix). The edit itself lives on the pushed change-server settings
 * screen; this module owns what applying it means.
 *
 * Applying points the app at the new instance and signs out, because both
 * halves of the session belong to the old server: the token pair was issued
 * by it, and the cached journal/queued writes belong to its account. The
 * login screen prefills the saved URL, so what the change costs is the
 * credentials, never retyping the host.
 */

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { useApiRequest } from '@/api/hooks';
import { saveServerUrl, useSession } from '@/api/session';
import { clearOutbox } from '@/lib/outbox';
import { usePushAlertStore } from '@/lib/push-alerts';
import { clearPersistedQueryCache } from '@/storage/mmkv';

/** `https://host:port/path` → `host` — the part that identifies the server. */
export function serverHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * The switch itself: unregister this device's push channel from the old
 * server, sign out, save the new URL, wipe every cache that belongs to the
 * old account, and land on the login screen.
 */
export function useApplyServerChange(): (next: string) => Promise<void> {
  const { signOut } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApiRequest();

  return async (next: string) => {
    // Best-effort against the old server while the token still works — this
    // device's alert channel should not outlive the session (same reasoning
    // as Sign out's unregister).
    const token = usePushAlertStore.getState().token;
    if (token) {
      try {
        await api('/me/push-tokens', { method: 'DELETE', body: { token } });
      } catch {
        // Moving servers matters more than a dead channel row on the old one.
      }
      usePushAlertStore.setState({ token: null });
    }
    await signOut();
    await saveServerUrl(next);
    // The cached journal and queued writes belong to the old account — wipe
    // the live cache, the MMKV snapshot, and the offline queue, exactly as
    // Sign out does.
    queryClient.clear();
    clearPersistedQueryCache();
    clearOutbox();
    router.replace('/login');
  };
}
