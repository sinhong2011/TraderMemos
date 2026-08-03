import {
  Host,
  LabeledContent,
  Section,
  SecureField,
  Text as UIText,
  TextField,
  Toggle,
  useNativeState,
} from '@expo/ui/swift-ui';
import {
  autocorrectionDisabled,
  foregroundStyle,
  keyboardType,
  scrollDismissesKeyboard,
  textInputAutocapitalization,
} from '@expo/ui/swift-ui/modifiers';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Alert } from 'react-native';

import { queryKeys, useApiRequest, useLlmSettings, type LlmKind } from '@/api/hooks';
import type { LlmApiSettings, LlmApiTestResult } from '@/api/types';
import { CenteredButton } from '@/components/centered-button';
import { t } from '@lingui/core/macro';
import { SettingsForm } from '@/components/settings-form';

/**
 * AI integrations (web AiTab parity): the vision-scan (OCR) and AI-coach LLM
 * endpoints share one settings shape, so each renders through the same form.
 * The API key is write-only — the server returns just a hint once set.
 * (Model discovery via /models stays on web; the model here is a text field.)
 */
export default function AiSettingsScreen() {
  return (
    <Host style={{ flex: 1 }}>
      <SettingsForm modifiers={[scrollDismissesKeyboard('immediately')]}>
        <LlmSection
          kind="ocr"
          title={t`Vision scan`}
          footer={t`Reads broker screenshots into executions on Import. Works with any OpenAI-compatible API.`}
        />
        <LlmSection
          kind="coach"
          title={t`AI coach`}
          footer={t`Reviews your journal and trades to surface patterns. Works with any OpenAI-compatible API.`}
        />
      </SettingsForm>
    </Host>
  );
}

function LlmSection({ kind, title, footer }: { kind: LlmKind; title: string; footer: string }) {
  const settings = useLlmSettings(kind);
  if (!settings.data) {
    return (
      <Section title={title}>
        <UIText modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
          {settings.isError ? t`Failed to load settings.` : t`Loading…`}
        </UIText>
      </Section>
    );
  }
  return <LlmSectionForm kind={kind} title={title} footer={footer} settings={settings.data} />;
}

function LlmSectionForm({
  kind,
  title,
  footer,
  settings,
}: {
  kind: LlmKind;
  title: string;
  footer: string;
  settings: LlmApiSettings;
}) {
  const queryClient = useQueryClient();
  const api = useApiRequest();

  const [enabled, setEnabled] = useState(settings.enabled);
  const initialBaseUrl = settings.base_url.trim() || 'https://api.openai.com/v1';
  const baseUrlState = useNativeState(initialBaseUrl);
  const baseUrlText = useRef(initialBaseUrl);
  const modelState = useNativeState(settings.model);
  const modelText = useRef(settings.model);
  const apiKeyState = useNativeState('');
  const apiKeyText = useRef('');
  const promptState = useNativeState(settings.custom_prompt ?? '');
  const promptText = useRef(settings.custom_prompt ?? '');

  const body = () => ({
    enabled,
    base_url: baseUrlText.current.trim(),
    model: modelText.current.trim() || 'gpt-4o-mini',
    custom_prompt: promptText.current.trim(),
    ...(apiKeyText.current.trim() ? { api_key: apiKeyText.current.trim() } : {}),
  });

  const save = useMutation({
    mutationFn: () => api(`/settings/${kind}`, { method: 'PUT', body: body() }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.llmSettings(kind) });
      Alert.alert(t`Saved`, t`${title} settings updated.`);
    },
    onError: (err) => Alert.alert(t`Could not save`, err.message),
  });

  const test = useMutation({
    mutationFn: () => {
      const { enabled: _enabled, custom_prompt: _prompt, ...connection } = body();
      return api<LlmApiTestResult>(`/settings/${kind}/test`, { method: 'POST', body: connection });
    },
    onSuccess: (result) => {
      if (result.ok) Alert.alert(t`Connection OK`, t`The endpoint answered successfully.`);
      else Alert.alert(t`Connection failed`, result.error ?? t`The endpoint did not answer.`);
    },
    onError: (err) => Alert.alert(t`Connection failed`, err.message),
  });

  const apiKeyPlaceholder = settings.api_key_set
    ? (settings.api_key_hint ?? t`Saved — leave blank to keep`)
    : t`sk-…`;

  return (
    <Section title={title} footer={<UIText>{footer}</UIText>}>
      <Toggle label={t`Enabled`} isOn={enabled} onIsOnChange={setEnabled} />
      <LabeledContent label={t`Base URL`}>
        <TextField
          placeholder="https://api.openai.com/v1"
          text={baseUrlState}
          onTextChange={(text) => {
            baseUrlText.current = text;
          }}
          modifiers={[
            keyboardType('url'),
            textInputAutocapitalization('never'),
            autocorrectionDisabled(),
          ]}
        />
      </LabeledContent>
      <LabeledContent label={t`Model`}>
        <TextField
          placeholder="gpt-4o-mini"
          text={modelState}
          onTextChange={(text) => {
            modelText.current = text;
          }}
          modifiers={[textInputAutocapitalization('never'), autocorrectionDisabled()]}
        />
      </LabeledContent>
      <LabeledContent label={t`API key`}>
        <SecureField
          placeholder={apiKeyPlaceholder}
          text={apiKeyState}
          onTextChange={(text) => {
            apiKeyText.current = text;
          }}
        />
      </LabeledContent>
      <TextField
        placeholder={t`Custom prompt (optional)`}
        text={promptState}
        axis="vertical"
        onTextChange={(text) => {
          promptText.current = text;
        }}
      />
      <CenteredButton
        label={save.isPending ? t`Saving…` : t`Save`}
        onPress={() => save.mutate()}
      />
      <CenteredButton
        label={test.isPending ? t`Testing…` : t`Test connection`}
        onPress={() => test.mutate()}
      />
    </Section>
  );
}
