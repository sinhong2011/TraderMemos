import { hasLocale } from 'next-intl';

export const locales = ['en', 'zh-Hant', 'zh-Hans', 'ja'] as const;

export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = 'en';

/** Narrow an arbitrary route param to a supported locale. */
export function resolveLocale(candidate: string | undefined | null): AppLocale {
  return hasLocale(locales, candidate) ? candidate : defaultLocale;
}
