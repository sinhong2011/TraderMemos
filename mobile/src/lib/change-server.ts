/**
 * Change the API server from inside the app — previously the URL was only
 * editable on the sign-in screen's Advanced sheet, so a moved or renumbered
 * server stranded a signed-in session with no way out but Sign out (and
 * nothing told you that was the fix).
 *
 * One value → `Alert.prompt`, the settings idiom for single-field edits.
 * Saving points the app at the new instance and signs out, because both
 * halves of the session belong to the old server: the token pair was issued
 * by it, and the cached journal/queued writes belong to its account. The
 * login screen prefills the saved URL, so what the change costs is the
 * credentials, never retyping the host.
 */

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';

import { useApiRequest } from '@/api/hooks';
import { normalizeServerUrl, saveServerUrl, useSession } from '@/api/session';
import { t } from '@lingui/core/macro';
import { clearOutbox } from '@/lib/outbox';
import { usePushAlertStore } from '@/lib/push-alerts';
import { clearPersistedQueryCache } from '@/storage/mmkv';

/** Returns the prompt-opener; safe to hand straight to an `onPress`. */
export function useChangeServer(): () => void {
  const { session, signOut } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApiRequest();

  async function applyChange(next: string) {
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
  }

  return () => {
    const current = session?.serverUrl ?? '';
    Alert.prompt(
      t`Change server?`,
      t`Points the app at a different TraderMemos instance and signs you out. Unsynced offline changes will be discarded.`,
      [
        { text: t`Cancel`, style: 'cancel' },
        {
          text: t`Change & sign out`,
          style: 'destructive',
          onPress: (value?: string) => {
            const next = normalizeServerUrl(value ?? '');
            // Empty or unchanged: nothing to move to — keep the session.
            if (!next || next === current) return;
            void applyChange(next);
          },
        },
      ],
      'plain-text',
      current,
    );
  };
}
