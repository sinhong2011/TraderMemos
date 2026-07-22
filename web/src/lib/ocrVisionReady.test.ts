import { describe, expect, it } from "vite-plus/test";
import { getOcrVisionSetupIssues, isOcrVisionReady } from "./ocrVisionReady";

describe("ocrVisionReady", () => {
  it("reports all issues when settings are missing", () => {
    expect(getOcrVisionSetupIssues(undefined)).toEqual(["disabled", "missing_api_key"]);
    expect(isOcrVisionReady(undefined)).toBe(false);
  });

  it("is ready when enabled with base URL and API key", () => {
    const settings = {
      enabled: true,
      base_url: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
      custom_prompt: "",
      api_key_set: true,
    };
    expect(getOcrVisionSetupIssues(settings)).toEqual([]);
    expect(isOcrVisionReady(settings)).toBe(true);
  });

  it("flags disabled and missing key", () => {
    const settings = {
      enabled: false,
      base_url: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
      custom_prompt: "",
      api_key_set: false,
    };
    expect(getOcrVisionSetupIssues(settings)).toEqual(["disabled", "missing_api_key"]);
  });
});
