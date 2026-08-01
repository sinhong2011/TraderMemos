/**
 * Lingui i18n runtime — the same stack as web (see web/src/i18n/index.tsx).
 *
 * Components use the `t` macro from `@lingui/core/macro`; catalogs are .po
 * files under `src/i18n/locales/<locale>/` compiled to `messages.ts` via
 * `pnpm i18n:compile`. All four catalogs load eagerly — they are tiny, and
 * mobile has no route-level code splitting to exploit.
 *
 * The locale is resolved once at startup: iOS restarts the app when the
 * per-app language changes, so no reactive locale switching is needed.
 */

import { i18n } from '@lingui/core';
import { getLocales } from 'expo-localization';

import { messages as enMessages } from './locales/en/messages';
import { messages as jaMessages } from './locales/ja/messages';
import { messages as koMessages } from './locales/ko/messages';
import { messages as zhHKMessages } from './locales/zh-HK/messages';

export type AppLocale = 'en' | 'ja' | 'ko' | 'zh-HK';

function resolveLocale(): AppLocale {
  try {
    const language = getLocales()[0]?.languageCode;
    if (language === 'ja') return 'ja';
    if (language === 'ko') return 'ko';
    // zh-HK is the only Chinese catalog (mirroring web); route all zh there.
    if (language === 'zh') return 'zh-HK';
  } catch {
    // Native module unavailable (e.g. stale dev build) — fall back to English.
  }
  return 'en';
}

export const locale: AppLocale = resolveLocale();

i18n.load({
  en: enMessages,
  ja: jaMessages,
  ko: koMessages,
  'zh-HK': zhHKMessages,
});
i18n.activate(locale);

export { i18n };
