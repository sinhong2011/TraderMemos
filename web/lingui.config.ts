import { defineConfig } from "@lingui/cli";

export default defineConfig({
  locales: ["en", "zh-HK", "ja", "ko"],
  sourceLocale: "en",
  compileNamespace: "es",
  catalogs: [
    {
      path: "src/i18n/locales/{locale}/messages",
      include: ["src"],
    },
  ],
});
