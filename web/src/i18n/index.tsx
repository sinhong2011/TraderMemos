import { i18n } from "@lingui/core";
import { I18nProvider as LinguiI18nProvider } from "@lingui/react";
import type { ReactNode } from "react";

// Start with an empty catalog; messages fall back to their default text.
// Compiled per-locale catalogs (via `lingui extract` + `compile`) and a
// language selector are added in a later task.
const catalogs: Record<string, Record<string, string>> = { en: {} };

export function loadLocale(locale: string) {
  i18n.load(locale, catalogs[locale] ?? {});
  i18n.activate(locale);
}

loadLocale("en");

export function I18nProvider({ children }: { children: ReactNode }) {
  return <LinguiI18nProvider i18n={i18n}>{children}</LinguiI18nProvider>;
}

export { i18n };
