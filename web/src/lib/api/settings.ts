import { apiFetch } from "./client";

export interface RiskRules {
  max_risk_per_trade: number | null;
  max_daily_loss: number | null;
  max_open_risk: number | null;
  default_account_risk_pct: number | null;
}

export interface ChecklistTemplate {
  items: string[];
}

export interface OcrSettings {
  enabled: boolean;
  base_url: string;
  model: string;
  custom_prompt: string;
  /** Built-in vision prompt; shown as textarea placeholder when custom is empty. */
  default_prompt?: string;
  api_key_set: boolean;
  api_key_hint?: string;
}

export interface OcrSettingsPut {
  enabled: boolean;
  base_url: string;
  model: string;
  custom_prompt: string;
  /** Omit or empty to keep the existing key. */
  api_key?: string;
}

export interface OcrSettingsTestResult {
  ok: boolean;
  error?: string;
}

export interface OcrSettingsTestRequest {
  base_url?: string;
  model?: string;
  /** Omit or empty to use the saved key. */
  api_key?: string;
}

export interface OcrModelsRequest {
  base_url?: string;
  /** Omit or empty to use the saved key. */
  api_key?: string;
}

export interface OcrModelsResult {
  models: string[];
  error?: string;
}

export const settingsApi = {
  getRiskRules: () => apiFetch<RiskRules>("/settings/risk-rules"),
  putRiskRules: (body: RiskRules) =>
    apiFetch<RiskRules>("/settings/risk-rules", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  getChecklistTemplate: () => apiFetch<ChecklistTemplate>("/settings/checklist-template"),
  putChecklistTemplate: (body: ChecklistTemplate) =>
    apiFetch<ChecklistTemplate>("/settings/checklist-template", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  getOcrSettings: () => apiFetch<OcrSettings>("/settings/ocr"),
  putOcrSettings: (body: OcrSettingsPut) =>
    apiFetch<OcrSettings>("/settings/ocr", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  testOcrSettings: (body: OcrSettingsTestRequest = {}) =>
    apiFetch<OcrSettingsTestResult>("/settings/ocr/test", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listOcrModels: (body: OcrModelsRequest = {}) =>
    apiFetch<OcrModelsResult>("/settings/ocr/models", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
