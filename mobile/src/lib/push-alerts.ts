/**
 * Expo push registration for journal alerts.
 *
 * The server treats each Expo push token as an alert channel
 * (POST/DELETE /me/push-tokens). This device's token is MMKV-persisted so the
 * Alerts screen renders the real registration state and sign-out can remove
 * exactly the token it registered — never another device's.
 */

import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { mmkvStorage } from '@/storage/zustand-mmkv';

const PERSIST_KEY = 'store:push-alerts';

type PushState = { token: string | null };

export const usePushAlertStore = create<PushState>()(
  persist((): PushState => ({ token: null }), {
    name: PERSIST_KEY,
    storage: mmkvStorage<PushState>(),
  }),
);

/** Thrown when push can't work here (simulator) or the user declined. */
export class PushUnavailableError extends Error {}

/**
 * Asks for notification permission (no-op if already granted) and returns this
 * device's Expo push token. Throws PushUnavailableError on simulators and when
 * permission is denied.
 */
export async function obtainPushToken(): Promise<string> {
  if (!Device.isDevice) {
    throw new PushUnavailableError('push requires a physical device');
  }
  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') {
    throw new PushUnavailableError('notification permission denied');
  }
  const projectId: string | undefined =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const { data } = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
  return data;
}

/** Human label for the channel row in Settings → Alert Channels. */
export function deviceLabel(): string {
  return Device.deviceName ?? Device.modelName ?? 'Mobile device';
}
