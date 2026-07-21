import type { OcrSettings } from "./api/settings";

export type OcrVisionSetupIssue = "disabled" | "missing_api_key" | "missing_base_url";

export function getOcrVisionSetupIssues(settings: OcrSettings | undefined): OcrVisionSetupIssue[] {
  if (!settings) return ["disabled", "missing_api_key"];

  const issues: OcrVisionSetupIssue[] = [];
  if (!settings.enabled) issues.push("disabled");
  if (!settings.base_url.trim()) issues.push("missing_base_url");
  if (!settings.api_key_set) issues.push("missing_api_key");
  return issues;
}

export function isOcrVisionReady(settings: OcrSettings | undefined): boolean {
  return getOcrVisionSetupIssues(settings).length === 0;
}

export const OCR_VISION_SETUP_STEPS: Record<
  OcrVisionSetupIssue,
  { label: string; detail: string }
> = {
  disabled: {
    label: "Enable screenshot scan",
    detail: "Turn on Screenshot scan under Settings → AI.",
  },
  missing_base_url: {
    label: "Set API base URL",
    detail: "Add your OpenAI-compatible endpoint (e.g. https://api.openai.com/v1).",
  },
  missing_api_key: {
    label: "Add API key",
    detail: "Paste a vision-capable API key. Keys stay on the server.",
  },
};
