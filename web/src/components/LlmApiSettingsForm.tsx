import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { ModelAutocomplete } from "./SignalAutocomplete";
import { SignalPasswordInput, SignalTextarea } from "./SignalInput";
import { useToastManager } from "./Toast";
import { cn } from "../lib/cn";
import {
  buildPrefixedUrl,
  llmApiModelsBody,
  llmApiSettingsPutBody,
  llmApiSettingsTestBody,
  llmApiSettingsToFormValues,
  parsePrefixedUrl,
  type LlmApiModelsResult,
  type LlmApiSettings,
  type LlmApiSettingsLabels,
  type LlmApiSettingsPut,
  type LlmApiSettingsTestResult,
} from "../lib/llmApiSettings";
import {
  BtnGhost,
  BtnPrimary,
  FormError,
  SavedBadge,
  SettingsBadge,
  SettingsGroup,
  SettingsGroupRow,
  SettingsPrefixedInput,
  SettingsToggle,
} from "../app/screens/settings/settings-ui";

export function LlmApiSettingsForm({
  settings,
  labels,
  saveErrorMessage,
  onSave,
  onTest,
  onListModels,
}: {
  settings: LlmApiSettings;
  labels: LlmApiSettingsLabels;
  saveErrorMessage: string;
  onSave: (body: LlmApiSettingsPut) => Promise<LlmApiSettings>;
  onTest: (body: ReturnType<typeof llmApiSettingsTestBody>) => Promise<LlmApiSettingsTestResult>;
  onListModels: (body: ReturnType<typeof llmApiModelsBody>) => Promise<LlmApiModelsResult>;
}) {
  const toast = useToastManager();
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);

  const form = useForm({
    defaultValues: llmApiSettingsToFormValues(settings),
    onSubmit: async ({ value }) => {
      setFormError(null);
      setSaved(false);
      setSaving(true);
      try {
        const body = llmApiSettingsPutBody(value);
        const next = await onSave(body);
        form.setFieldValue("enabled", next.enabled);
        form.setFieldValue("base_url", next.base_url);
        form.setFieldValue("model", next.model);
        form.setFieldValue("custom_prompt", next.custom_prompt);
        form.setFieldValue("api_key", "");
        setSaved(true);
      } catch (err) {
        setFormError(err instanceof Error ? err.message : saveErrorMessage);
      } finally {
        setSaving(false);
      }
    },
  });

  const restoreDraft = (draft: ReturnType<typeof llmApiSettingsToFormValues>) => {
    form.setFieldValue("enabled", draft.enabled);
    form.setFieldValue("base_url", draft.base_url);
    form.setFieldValue("model", draft.model);
    form.setFieldValue("custom_prompt", draft.custom_prompt);
    form.setFieldValue("api_key", draft.api_key);
  };

  const onTestConnection = async () => {
    const draft = { ...form.state.values };
    setTesting(true);
    try {
      setFormError(null);
      const result = await onTest(llmApiSettingsTestBody(draft));
      restoreDraft(draft);

      if (result.ok) {
        toast.add({ title: "Connection OK", description: "API responded." });
      } else {
        toast.add({
          title: "Connection failed",
          description: result.error || "API rejected the request",
        });
      }
    } catch (err) {
      restoreDraft(draft);
      toast.add({
        title: "Connection failed",
        description: err instanceof Error ? err.message : "Request failed",
      });
    } finally {
      setTesting(false);
    }
  };

  const onFetchModels = async () => {
    setFetchingModels(true);
    try {
      const value = form.state.values;
      const result = await onListModels(llmApiModelsBody(value));
      if (result.error) {
        toast.add({
          title: labels.fetchModels,
          description: result.error,
        });
        return;
      }
      setModelOptions(result.models);
      toast.add({
        title: labels.fetchModels,
        description: `${result.models.length} models`,
      });
    } catch (err) {
      toast.add({
        title: labels.fetchModels,
        description: err instanceof Error ? err.message : "Request failed",
      });
    } finally {
      setFetchingModels(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <SettingsGroup>
        <form.Field name="enabled">
          {(field) => (
            <SettingsGroupRow label={labels.enabled} detail={labels.enabledDetail}>
              <SettingsToggle
                checked={field.state.value}
                onCheckedChange={field.handleChange}
                aria-label={labels.enabled}
              />
            </SettingsGroupRow>
          )}
        </form.Field>
        <form.Subscribe selector={(s) => s.values.enabled}>
          {(enabled) => (
            <fieldset
              disabled={!enabled}
              className={cn(
                "contents border-none p-0",
                !enabled && "[&_*]:pointer-events-none [&_*]:opacity-45",
              )}
            >
              <form.Field name="base_url">
                {(field) => {
                  const parsed = parsePrefixedUrl(field.state.value);
                  return (
                    <SettingsGroupRow
                      label={labels.baseUrl}
                      detail={labels.baseUrlDetail}
                      badge={<SettingsBadge tone="required">Required</SettingsBadge>}
                    >
                      <SettingsPrefixedInput
                        scheme={parsed.scheme}
                        onSchemeChange={(scheme) => {
                          field.handleChange(buildPrefixedUrl(scheme, parsed.host));
                        }}
                        value={parsed.host}
                        onChange={(host) => {
                          field.handleChange(buildPrefixedUrl(parsed.scheme, host));
                        }}
                        onBlur={field.handleBlur}
                        placeholder="api.openai.com/v1"
                        aria-label={labels.baseUrl}
                      />
                    </SettingsGroupRow>
                  );
                }}
              </form.Field>
              <form.Field name="model">
                {(field) => (
                  <SettingsGroupRow label={labels.model} detail={labels.modelDetail}>
                    <ModelAutocomplete
                      value={field.state.value}
                      onValueChange={(next) => field.handleChange(next)}
                      models={modelOptions}
                      onFetchModels={() => void onFetchModels()}
                      fetching={fetchingModels}
                      fetchLabel={fetchingModels ? labels.fetchingModels : labels.fetchModels}
                      placeholder="gpt-4o-mini"
                      className="w-full"
                      inputClassName="h-10 w-full text-[13px]"
                      ariaLabel={labels.model}
                    />
                  </SettingsGroupRow>
                )}
              </form.Field>
              <form.Field name="api_key">
                {(field) => (
                  <SettingsGroupRow
                    label={labels.apiKey}
                    detail={labels.apiKeyDetail}
                    badge={<SettingsBadge tone="required">Required</SettingsBadge>}
                  >
                    <SignalPasswordInput
                      autoComplete="off"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onClear={() => field.handleChange("")}
                      placeholder={
                        settings.api_key_set ? settings.api_key_hint || labels.apiKeyHint : "sk-…"
                      }
                      spellCheck={false}
                      className="h-10 w-full text-[13px]"
                      aria-label={labels.apiKey}
                      showLabel="Show API key"
                      hideLabel="Hide API key"
                      clearLabel="Clear API key"
                    />
                  </SettingsGroupRow>
                )}
              </form.Field>
              <form.Field name="custom_prompt">
                {(field) => (
                  <SettingsGroupRow
                    label={labels.customPrompt}
                    detail={labels.customPromptHint}
                    alignTop
                    last
                  >
                    <SignalTextarea
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder={settings.default_prompt || labels.customPromptHint}
                      spellCheck={false}
                      rows={6}
                      className="min-h-[8rem] w-full whitespace-pre-wrap text-[12px] leading-relaxed"
                      aria-label={labels.customPrompt}
                    />
                  </SettingsGroupRow>
                )}
              </form.Field>
            </fieldset>
          )}
        </form.Subscribe>
        {formError ? (
          <div className="px-5 py-3">
            <FormError message={formError} />
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-end gap-2 px-5 py-4">
          <SavedBadge show={saved} />
          <BtnGhost
            type="button"
            size="action"
            disabled={testing}
            onClick={() => void onTestConnection()}
          >
            {testing ? labels.testing : labels.test}
          </BtnGhost>
          <BtnPrimary type="submit" disabled={saving}>
            {saving ? "Saving…" : labels.save}
          </BtnPrimary>
        </div>
      </SettingsGroup>
    </form>
  );
}
