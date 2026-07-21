import { apiFetch } from "./client";
import type {
  LlmApiModelsRequest,
  LlmApiModelsResult,
  LlmApiSettings,
  LlmApiSettingsPut,
  LlmApiSettingsTestRequest,
  LlmApiSettingsTestResult,
} from "../llmApiSettings";

export type { LlmApiSettings as OcrSettings, LlmApiSettingsPut as OcrSettingsPut };
export type { LlmApiSettingsTestRequest as OcrSettingsTestRequest };
export type { LlmApiSettingsTestResult as OcrSettingsTestResult };
export type { LlmApiModelsRequest as OcrModelsRequest };
export type { LlmApiModelsResult as OcrModelsResult };

export type CoachSettings = LlmApiSettings;
export type CoachSettingsPut = LlmApiSettingsPut;

export interface RiskRules {
  max_risk_per_trade: number | null;
  max_daily_loss: number | null;
  max_open_risk: number | null;
  default_account_risk_pct: number | null;
}

export interface ChecklistTemplate {
  items: string[];
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
  getOcrSettings: () => apiFetch<LlmApiSettings>("/settings/ocr"),
  putOcrSettings: (body: LlmApiSettingsPut) =>
    apiFetch<LlmApiSettings>("/settings/ocr", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  testOcrSettings: (body: LlmApiSettingsTestRequest = {}) =>
    apiFetch<LlmApiSettingsTestResult>("/settings/ocr/test", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listOcrModels: (body: LlmApiModelsRequest = {}) =>
    apiFetch<LlmApiModelsResult>("/settings/ocr/models", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getCoachSettings: () => apiFetch<CoachSettings>("/settings/coach"),
  putCoachSettings: (body: CoachSettingsPut) =>
    apiFetch<CoachSettings>("/settings/coach", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  testCoachSettings: (body: LlmApiSettingsTestRequest = {}) =>
    apiFetch<LlmApiSettingsTestResult>("/settings/coach/test", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listCoachModels: (body: LlmApiModelsRequest = {}) =>
    apiFetch<LlmApiModelsResult>("/settings/coach/models", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
