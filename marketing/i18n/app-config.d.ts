import type en from '../messages/en.json';
import type { locales } from './locales';

/** Typed message keys and locales for next-intl (v4 AppConfig augmentation). */
declare module 'next-intl' {
  interface AppConfig {
    Locale: (typeof locales)[number];
    Messages: typeof en;
  }
}
