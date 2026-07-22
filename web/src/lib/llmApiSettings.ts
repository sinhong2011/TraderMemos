export interface LlmApiSettings {
  enabled: boolean;
  base_url: string;
  model: string;
  custom_prompt: string;
  default_prompt?: string;
  api_key_set: boolean;
  api_key_hint?: string;
}

export type LlmApiSettingsFormValues = {
  enabled: boolean;
  base_url: string;
  model: string;
  custom_prompt: string;
  api_key: string;
};

export type LlmApiSettingsPut = {
  enabled: boolean;
  base_url: string;
  model: string;
  custom_prompt: string;
  api_key?: string;
};

export type LlmApiSettingsTestRequest = {
  base_url?: string;
  model?: string;
  api_key?: string;
};

export type LlmApiModelsRequest = {
  base_url?: string;
  api_key?: string;
};

export type LlmApiSettingsTestResult = {
  ok: boolean;
  error?: string;
};

export type LlmApiModelsResult = {
  models: string[];
  error?: string;
};

export function llmApiSettingsToFormValues(settings: LlmApiSettings): LlmApiSettingsFormValues {
  return {
    enabled: settings.enabled,
    base_url: settings.base_url.trim() || "https://api.openai.com/v1",
    model: settings.model.trim(),
    custom_prompt: settings.custom_prompt ?? "",
    api_key: "",
  };
}

export function llmApiSettingsPutBody(value: LlmApiSettingsFormValues): LlmApiSettingsPut {
  return {
    enabled: value.enabled,
    base_url: value.base_url.trim(),
    model: value.model.trim() || "gpt-4o-mini",
    custom_prompt: value.custom_prompt.trim(),
    ...(value.api_key.trim() ? { api_key: value.api_key.trim() } : {}),
  };
}

export function llmApiSettingsTestBody(value: LlmApiSettingsFormValues): LlmApiSettingsTestRequest {
  return {
    base_url: value.base_url.trim(),
    model: value.model.trim() || "gpt-4o-mini",
    ...(value.api_key.trim() ? { api_key: value.api_key.trim() } : {}),
  };
}

export type UrlScheme = "http" | "https";

export function parsePrefixedUrl(value: string): { scheme: UrlScheme; host: string } {
  const trimmed = value.trim();
  if (trimmed.startsWith("http://")) {
    return { scheme: "http", host: trimmed.slice("http://".length) };
  }
  if (trimmed.startsWith("https://")) {
    return { scheme: "https", host: trimmed.slice("https://".length) };
  }
  return { scheme: "https", host: trimmed };
}

export function buildPrefixedUrl(scheme: UrlScheme, host: string): string {
  const trimmed = host.trim();
  if (!trimmed) return "";
  return `${scheme}://${trimmed}`;
}

export function llmApiModelsBody(value: LlmApiSettingsFormValues): LlmApiModelsRequest {
  return {
    base_url: value.base_url.trim(),
    ...(value.api_key.trim() ? { api_key: value.api_key.trim() } : {}),
  };
}

export type LlmApiSettingsLabels = {
  enabled: string;
  enabledDetail: string;
  off: string;
  on: string;
  baseUrl: string;
  baseUrlDetail: string;
  model: string;
  modelDetail: string;
  fetchModels: string;
  fetchingModels: string;
  apiKey: string;
  apiKeyHint: string;
  apiKeyDetail: string;
  customPrompt: string;
  customPromptHint: string;
  save: string;
  test: string;
  testing: string;
};
