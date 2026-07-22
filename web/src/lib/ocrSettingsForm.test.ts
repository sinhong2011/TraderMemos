import { describe, expect, it } from "vite-plus/test";
import {
  ocrSettingsPutBody,
  ocrSettingsTestBody,
  ocrSettingsToFormValues,
} from "./ocrSettingsForm";

describe("ocrSettingsForm", () => {
  it("maps server settings to form values", () => {
    expect(
      ocrSettingsToFormValues({
        enabled: true,
        base_url: "https://vision.example/v1",
        model: "gpt-4o",
        custom_prompt: "Extract fills carefully",
        api_key_set: true,
        api_key_hint: "…abcd",
      }),
    ).toEqual({
      enabled: true,
      base_url: "https://vision.example/v1",
      model: "gpt-4o",
      custom_prompt: "Extract fills carefully",
      api_key: "",
    });
  });

  it("builds put body and omits empty api key", () => {
    expect(
      ocrSettingsPutBody({
        enabled: true,
        base_url: " https://x ",
        model: " ",
        custom_prompt: "  hello  ",
        api_key: "",
      }),
    ).toEqual({
      enabled: true,
      base_url: "https://x",
      model: "gpt-4o-mini",
      custom_prompt: "hello",
    });
  });

  it("builds test body without enabled", () => {
    expect(
      ocrSettingsTestBody({
        enabled: false,
        base_url: "https://x",
        model: "gpt-4o",
        custom_prompt: "x",
        api_key: "sk-test",
      }),
    ).toEqual({
      base_url: "https://x",
      model: "gpt-4o",
      api_key: "sk-test",
    });
  });
});
