import type { SettingsSectionId } from "../app/screens/settings/settings-ui";

export const SETTINGS_SECTION_IDS: SettingsSectionId[] = [
  "accounts",
  "rules",
  "journal",
  "general",
];

export const DEFAULT_SETTINGS_SECTION: SettingsSectionId = "accounts";

export function parseSettingsHash(hash: string): SettingsSectionId {
  const id = hash.replace(/^#/, "") as SettingsSectionId;
  return SETTINGS_SECTION_IDS.includes(id) ? id : DEFAULT_SETTINGS_SECTION;
}

export function settingsSectionHash(id: SettingsSectionId): string {
  return `#${id}`;
}
