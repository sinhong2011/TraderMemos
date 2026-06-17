import { defineConfig } from "@lingui/cli";

export default defineConfig({
  locales: ["en"],
  sourceLocale: "en",
  catalogs: [
    {
      path: "src/i18n/locales/{locale}/messages",
      include: ["src"],
    },
  ],
});
