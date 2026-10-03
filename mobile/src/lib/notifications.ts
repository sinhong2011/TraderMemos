/**
 * Push-tap routing. The server's alerts carry `data.url` — an in-app deep
 * link (`tradermemos://cooldown?suggest=loss_streak`, see api
 * internal/alerts/notify.go) — and this is the one place the app turns a tap
 * on that notification into navigation. Expo Router owns everything past the
 * path, same as a URL opened from anywhere else.
 *
 * Also declares the foreground presentation: without a handler, a push that
 * lands while the app is open is swallowed silently, which for "you just hit
 * your loss streak" is the worst possible moment to say nothing.
 */
import * as Notifications from 'expo-notifications';
import { useRootNavigationState, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useSession } from '@/api/session';

const SCHEME = 'tradermemos://';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** The router path for a `tradermemos://` URL, or null for anything else. */
export function routeFromNotificationURL(url: unknown): string | null {
  if (typeof url !== 'string' || !url.startsWith(SCHEME)) return null;
  const path = url.slice(SCHEME.length);
  if (!path || path.startsWith('/')) return null;
  return `/${path}`;
}

/**
 * Mounted once from the root layout (NotificationGate). Handles the response
 * that launched the app and every tap while it runs; each response is
 * handled once, keyed on its identifier + tap time.
 */
export function useNotificationRouting(): void {
  const router = useRouter();
  const { session, isLoading } = useSession();
  const navigationState = useRootNavigationState();
  const ready = navigationState?.key != null && !isLoading && session != null;
  const handled = useRef(new Set<string>());

  useEffect(() => {
    if (!ready) return;
    const handle = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const key = `${response.notification.request.identifier}:${response.notification.date}`;
      if (handled.current.has(key)) return;
      handled.current.add(key);
      const route = routeFromNotificationURL(response.notification.request.content.data?.url);
      if (route) router.push(route as never);
    };
    void Notifications.getLastNotificationResponseAsync().then(handle);
    const subscription = Notifications.addNotificationResponseReceivedListener(handle);
    return () => subscription.remove();
  }, [ready, router]);
}
