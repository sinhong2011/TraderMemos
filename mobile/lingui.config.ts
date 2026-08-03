import { defineConfig } from '@lingui/cli';

// Mirrors web/lingui.config.ts — same locales, catalog layout, and compile
// namespace so translations can move between the two apps.
export default defineConfig({
  locales: ['en', 'zh-HK', 'ja', 'ko'],
  sourceLocale: 'en',
  compileNamespace: 'es',
  catalogs: [
    {
      path: 'src/i18n/locales/{locale}/messages',
      include: ['src'],
    },
  ],
});
