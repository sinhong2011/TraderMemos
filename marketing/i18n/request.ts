import { getRequestConfig } from 'next-intl/server';
import { resolveLocale } from './locales';

/**
 * Locale routing is owned by the fumadocs i18n middleware (proxy.ts) via the
 * `[lang]` segment; layouts forward it with `setRequestLocale`, which arrives
 * here as `requestLocale`.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const locale = resolveLocale(await requestLocale);

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
