/**
 * Opening what a tapped notification points at.
 *
 * Server alerts can carry a `route` in their push data — an in-app path such
 * as `/edit-note?id=…` (the weekly review sends one). Any alert can reuse it:
 * this module knows nothing about the alert kinds, only that a route is a
 * path inside this app.
 *
 * Covers both launches: a tap that cold-starts the app (the native module
 * keeps that response until JS asks for it) and a tap on a running app.
 */

import * as Notifications from 'expo-notifications';
import { useRootNavigationState, useRouter, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useSession } from '@/api/session';

/**
 * The in-app path a notification's data asks to open, or null. Only absolute
 * app paths count — never a URL or a scheme, so a push can't be used to send
 * the app somewhere outside itself.
 */
export function notificationRoute(data: unknown): string | null {
  if (data == null || typeof data !== 'object') return null;
  const route = (data as Record<string, unknown>).route;
  if (typeof route !== 'string') return null;
  const path = route.trim();
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('://')) return null;
  return path;
}

/**
 * Routes notification taps once navigation and the session are ready. A
 * signed-out tap waits: the route opens after sign-in, when there is an
 * account to load it from.
 */
export function useNotificationRouting() {
  const router = useRouter();
  const { session, isLoading } = useSession();
  const navigationState = useRootNavigationState();
  const ready = navigationState?.key != null && !isLoading && session != null;
  const response = Notifications.useLastNotificationResponse();
  // A response is a one-shot hand-off: the hook can hand the same one back on
  // a remount, and clearing it is asynchronous on the native side.
  const handled = useRef(new Set<string>());

  useEffect(() => {
    if (!ready || !response) return;
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const key = `${response.notification.request.identifier}:${response.notification.date}`;
    if (handled.current.has(key)) return;
    handled.current.add(key);
    // Consumed — a later relaunch must not replay it.
    Notifications.clearLastNotificationResponse();
    const route = notificationRoute(response.notification.request.content.data);
    if (route) router.push(route as Href);
  }, [ready, response, router]);
}
