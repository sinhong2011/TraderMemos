/**
 * Device-side override for the web-app origin used to build share links.
 *
 * Three sources, most specific first: this override, the server's advertised
 * `web_url` (TM_PUBLIC_WEB_URL), then the signed-in API origin — correct for
 * the bundled nginx deployment, where one origin serves both the SPA and
 * `/api`. The override exists because a split deployment whose server admin
 * hasn't set TM_PUBLIC_WEB_URL would otherwise hand out links to the API host,
 * which serves no visitor page.
 *
 * Not a display pref: `lib/prefs` is formatting state that syncs to the
 * server, and this is a device-local pointer *at* a deployment.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { mmkvStorage } from '@/storage/zustand-mmkv';

const PERSIST_KEY = 'store:share-prefs';

type SharePrefsState = {
  /** Origin without a trailing slash; `null` defers to the server / API origin. */
  webBaseUrl: string | null;
};

export const useSharePrefsStore = create<SharePrefsState>()(
  persist((): SharePrefsState => ({ webBaseUrl: null }), {
    name: PERSIST_KEY,
    storage: mmkvStorage<SharePrefsState>(),
  }),
);

/**
 * Accepts what someone actually types — `tm.example.com`, a trailing slash, a
 * stray space — and returns the normalized origin, or `null` for "unset".
 * Throws on input that isn't a URL at all, so the caller can say so.
 */
export function normalizeWebBaseUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  // A bare host is the common typing; assume https rather than rejecting it.
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withScheme);
  if (url.hostname === '') throw new Error('missing host');
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}

export function setWebBaseUrl(value: string | null) {
  useSharePrefsStore.setState({ webBaseUrl: value });
}

export function useWebBaseUrl(): string | null {
  return useSharePrefsStore((state) => state.webBaseUrl);
}
