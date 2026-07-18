import type { OcrSettings } from "./api/settings";

export type OcrSettingsFormValues = {
  enabled: boolean;
  base_url: string;
  model: string;
  custom_prompt: string;
  api_key: string;
};

export function ocrSettingsToFormValues(settings: OcrSettings): OcrSettingsFormValues {
  return {
    enabled: settings.enabled,
    base_url: settings.base_url.trim() || "https://api.openai.com/v1",
    model: settings.model.trim(),
    custom_prompt: settings.custom_prompt ?? "",
    api_key: "",
  };
}

export function ocrSettingsPutBody(value: OcrSettingsFormValues) {
  return {
    enabled: value.enabled,
    base_url: value.base_url.trim(),
    model: value.model.trim() || "gpt-4o-mini",
    custom_prompt: value.custom_prompt.trim(),
    ...(value.api_key.trim() ? { api_key: value.api_key.trim() } : {}),
  };
}

export function ocrSettingsTestBody(value: OcrSettingsFormValues) {
  return {
    base_url: value.base_url.trim(),
    model: value.model.trim() || "gpt-4o-mini",
    ...(value.api_key.trim() ? { api_key: value.api_key.trim() } : {}),
  };
}
