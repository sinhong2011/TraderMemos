/**
 * Session state: the self-hosted server URL plus the token pair.
 *
 * TraderMemos is self-hosted, so there is no default host — the user supplies one at
 * login, mirroring the web app's "Set Server at login" flow. Tokens live in
 * SecureStore (Keychain / Keystore), never AsyncStorage.
 */

import * as SecureStore from 'expo-secure-store';
import { createContext, use } from 'react';

import type { TokenPair } from './types';

const SERVER_KEY = 'tm.server_url';
const ACCESS_KEY = 'tm.access_token';
const REFRESH_KEY = 'tm.refresh_token';

export type Session = {
  serverUrl: string;
  accessToken: string;
  refreshToken: string;
};

export async function loadSession(): Promise<Session | null> {
  const [serverUrl, accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(SERVER_KEY),
    SecureStore.getItemAsync(ACCESS_KEY),
    SecureStore.getItemAsync(REFRESH_KEY),
  ]);
  if (!serverUrl || !accessToken || !refreshToken) return null;
  return { serverUrl, accessToken, refreshToken };
}

export async function saveSession(session: Session): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(SERVER_KEY, session.serverUrl),
    SecureStore.setItemAsync(ACCESS_KEY, session.accessToken),
    SecureStore.setItemAsync(REFRESH_KEY, session.refreshToken),
  ]);
}

/** Clears tokens but keeps the server URL, so re-login doesn't retype the host. */
export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
  ]);
}

export async function loadServerUrl(): Promise<string | null> {
  return SecureStore.getItemAsync(SERVER_KEY);
}

/** Points the app at a different instance — callers sign out around this (the tokens belong to the old server). */
export async function saveServerUrl(url: string): Promise<void> {
  await SecureStore.setItemAsync(SERVER_KEY, url);
}

export async function saveTokens(tokens: TokenPair): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, tokens.access_token),
    SecureStore.setItemAsync(REFRESH_KEY, tokens.refresh_token),
  ]);
}

/**
 * Normalizes user-typed hosts: `192.168.1.10:8080` -> `http://192.168.1.10:8080`,
 * and strips a trailing slash so path joins stay predictable.
 */
export function normalizeServerUrl(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `http://${trimmed}`;
}

export type SessionContextValue = {
  session: Session | null;
  /** Null while the initial SecureStore read is in flight. */
  isLoading: boolean;
  signIn: (session: Session) => Promise<void>;
  signOut: () => Promise<void>;
};

export const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const value = use(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
}
