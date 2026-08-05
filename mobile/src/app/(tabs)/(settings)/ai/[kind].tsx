import {
  Button,
  Divider,
  Host,
  HStack,
  Image,
  Menu,
  Section,
  Spacer,
  Text as UIText,
  TextField,
  Toggle,
  useNativeState,
} from '@expo/ui/swift-ui';
import {
  foregroundStyle,
  lineLimit,
  scrollDismissesKeyboard,
  truncationMode,
} from '@expo/ui/swift-ui/modifiers';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import { queryKeys, useApiRequest, useLlmSettings, type LlmKind } from '@/api/hooks';
import type { LlmApiSettings, LlmApiTestResult, LlmModelsResult } from '@/api/types';
import { CenteredButton } from '@/components/centered-button';
import { GlassButton } from '@/components/glass-button';
import { SettingsForm } from '@/components/settings-form';
import { t } from '@lingui/core/macro';

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

/** Per-integration copy — everything else about the two forms is identical. */
function kindCopy(kind: LlmKind) {
  return kind === 'coach'
    ? {
        title: t`AI coach`,
        blurb: t`Reviews your journal and trades to surface patterns on the dashboard.`,
        promptHint: t`Extra instructions for the review — tone, what to focus on, what to ignore.`,
      }
    : {
        title: t`Vision scan`,
        blurb: t`Reads broker screenshots into executions on Import.`,
        promptHint: t`Extra instructions for reading screenshots — broker quirks, date formats.`,
      };
}

/**
 * One LLM endpoint (vision scan or AI coach). Values edit through native
 * prompts rather than inline fields — a base URL or key is far too long for a
 * form row, and the settings idiom here is tap-a-row-to-edit. Save lives in
 * the nav bar and lights up only when something changed, so the screen has no
 * standing action rows; the connection test reports inline instead of through
 * an alert.
 */
export default function AiProviderScreen() {
  const params = useLocalSearchParams<{ kind: string }>();
  const kind: LlmKind = params.kind === 'coach' ? 'coach' : 'ocr';
  const copy = kindCopy(kind);
  const settings = useLlmSettings(kind);

  if (!settings.data) {
    return (
      <Host style={{ flex: 1 }}>
        <Stack.Screen options={{ title: copy.title }} />
        <SettingsForm>
          <Section>
            <UIText modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
              {settings.isError ? t`Failed to load settings.` : t`Loading…`}
            </UIText>
          </Section>
        </SettingsForm>
      </Host>
    );
  }
  // Mount the form only once the settings are in cache, so every field can
  // initialize straight from them (no prefill effects).
  return <ProviderForm kind={kind} settings={settings.data} />;
}

function ProviderForm({ kind, settings }: { kind: LlmKind; settings: LlmApiSettings }) {
  const { theme } = useUnistyles();
  const queryClient = useQueryClient();
  const api = useApiRequest();
  const copy = kindCopy(kind);

  const [enabled, setEnabled] = useState(settings.enabled);
  const [baseUrl, setBaseUrl] = useState(settings.base_url.trim() || DEFAULT_BASE_URL);
  const [model, setModel] = useState(settings.model.trim());
  // Empty means "keep the stored key" — the server only ever returns a hint.
  const [apiKey, setApiKey] = useState('');
  const promptState = useNativeState(settings.custom_prompt ?? '');
  const promptText = useRef(settings.custom_prompt ?? '');
  const [dirty, setDirty] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const connection = () => ({
    base_url: baseUrl.trim(),
    model: model.trim(),
    ...(apiKey.trim() ? { api_key: apiKey.trim() } : {}),
  });

  const save = useMutation({
    mutationFn: () =>
      api<LlmApiSettings>(`/settings/${kind}`, {
        method: 'PUT',
        body: { enabled, custom_prompt: promptText.current.trim(), ...connection() },
      }),
    onSuccess: (next) => {
      queryClient.setQueryData(queryKeys.llmSettings(kind), next);
      void queryClient.invalidateQueries({ queryKey: queryKeys.llmSettings(kind) });
      // The key is now stored server-side; drop the local copy and let the
      // quiet Save button stand in for a confirmation.
      setApiKey('');
      setDirty(false);
    },
    onError: (err) => Alert.alert(t`Could not save`, err.message),
  });

  const test = useMutation({
    mutationFn: () =>
      api<LlmApiTestResult>(`/settings/${kind}/test`, { method: 'POST', body: connection() }),
    onSuccess: (result) =>
      setTestResult({
        ok: result.ok,
        message: result.ok ? t`Connection OK` : (result.error ?? t`The endpoint did not answer.`),
      }),
    onError: (err) => setTestResult({ ok: false, message: err.message }),
  });

  const listModels = useMutation({
    mutationFn: () =>
      api<LlmModelsResult>(`/settings/${kind}/models`, {
        method: 'POST',
        body: {
          base_url: baseUrl.trim(),
          ...(apiKey.trim() ? { api_key: apiKey.trim() } : {}),
        },
      }),
    onSuccess: (result) => {
      if (result.error) {
        Alert.alert(t`Could not load models`, result.error);
        return;
      }
      setModels(result.models);
      if (result.models.length === 0) Alert.alert(t`No models`, t`The endpoint listed no models.`);
    },
    onError: (err) => Alert.alert(t`Could not load models`, err.message),
  });

  function editBaseUrl() {
    Alert.prompt(
      t`Base URL`,
      t`The root of an OpenAI-compatible API, ending in /v1.`,
      [
        { text: t`Cancel`, style: 'cancel' },
        {
          text: t`Done`,
          onPress: (text?: string) => {
            const next = (text ?? '').trim();
            if (!next) return;
            if (!next.startsWith('http://') && !next.startsWith('https://')) {
              Alert.alert(t`Invalid URL`, t`The base URL must start with http:// or https://.`);
              return;
            }
            setBaseUrl(next);
            // Models are per-endpoint — a new host invalidates the list.
            setModels([]);
            setTestResult(null);
            setDirty(true);
          },
        },
      ],
      'plain-text',
      baseUrl,
      'url',
    );
  }

  function editApiKey() {
    Alert.prompt(
      t`API key`,
      settings.api_key_set
        ? t`Leave blank to keep the key already stored on the server.`
        : t`Stored on your server, never on this phone.`,
      [
        { text: t`Cancel`, style: 'cancel' },
        {
          text: t`Done`,
          onPress: (text?: string) => {
            const next = (text ?? '').trim();
            if (!next) return;
            setApiKey(next);
            setTestResult(null);
            setDirty(true);
          },
        },
      ],
      'secure-text',
      '',
    );
  }

  function editModel() {
    Alert.prompt(
      t`Model`,
      t`The model id as the endpoint spells it, e.g. gpt-4o-mini.`,
      [
        { text: t`Cancel`, style: 'cancel' },
        {
          text: t`Done`,
          onPress: (text?: string) => pickModel((text ?? '').trim()),
        },
      ],
      'plain-text',
      model,
    );
  }

  function pickModel(next: string) {
    if (!next) return;
    setModel(next);
    setTestResult(null);
    setDirty(true);
  }

  const apiKeyValue = apiKey
    ? t`Entered — not saved yet`
    : settings.api_key_set
      ? (settings.api_key_hint ?? t`Saved`)
      : t`Not set`;

  return (
    <Host style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: copy.title,
          headerRight: () => (
            <GlassButton
              prominent
              disabled={!dirty || save.isPending}
              label={save.isPending ? t`Saving…` : t`Save`}
              onPress={() => save.mutate()}
            />
          ),
        }}
      />
      <SettingsForm modifiers={[scrollDismissesKeyboard('immediately')]}>
        <Section footer={<UIText>{copy.blurb}</UIText>}>
          <Toggle
            label={t`Enabled`}
            isOn={enabled}
            onIsOnChange={(value) => {
              setEnabled(value);
              setDirty(true);
            }}
          />
        </Section>

        <Section
          title={t`Connection`}
          footer={
            testResult ? (
              <UIText
                modifiers={[
                  foregroundStyle(testResult.ok ? theme.colors.profit : theme.colors.destructive),
                ]}
              >
                {testResult.message}
              </UIText>
            ) : (
              <UIText>{t`Any OpenAI-compatible endpoint works. Test uses the values above, saved or not.`}</UIText>
            )
          }
        >
          <ValueRow label={t`Base URL`} value={baseUrl} onPress={editBaseUrl} />

          <Menu
            label={
              <HStack spacing={8}>
                <UIText modifiers={[foregroundStyle({ type: 'hierarchical', style: 'primary' })]}>
                  {t`Model`}
                </UIText>
                <Spacer />
                <UIText
                  modifiers={[
                    foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                    lineLimit(1),
                    truncationMode('middle'),
                  ]}
                >
                  {model || t`Default`}
                </UIText>
                <Image
                  systemName="chevron.up.chevron.down"
                  size={11}
                  color={theme.colors.mutedForeground}
                />
              </HStack>
            }
          >
            {models.map((name) => (
              <Button
                key={name}
                label={name}
                systemImage={name === model ? 'checkmark' : undefined}
                onPress={() => pickModel(name)}
              />
            ))}
            {models.length > 0 ? <Divider /> : null}
            <Button
              label={listModels.isPending ? t`Loading models…` : t`Fetch models`}
              systemImage="arrow.down.circle"
              onPress={() => {
                if (!listModels.isPending) listModels.mutate();
              }}
            />
            <Button label={t`Type a model id…`} systemImage="keyboard" onPress={editModel} />
          </Menu>

          <ValueRow label={t`API key`} value={apiKeyValue} onPress={editApiKey} />

          <CenteredButton
            label={test.isPending ? t`Testing…` : t`Test connection`}
            onPress={() => {
              if (test.isPending) return;
              setTestResult(null);
              test.mutate();
            }}
          />
        </Section>

        <Section title={t`Prompt`} footer={<UIText>{copy.promptHint}</UIText>}>
          <TextField
            placeholder={t`Leave blank to use the built-in prompt`}
            text={promptState}
            axis="vertical"
            modifiers={[lineLimit({ min: 3, max: 10 })]}
            onTextChange={(text) => {
              promptText.current = text;
              setDirty(true);
            }}
          />
        </Section>
      </SettingsForm>
    </Host>
  );
}

/** Settings row whose value is edited in a native prompt. */
function ValueRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  const { theme } = useUnistyles();
  return (
    <Button onPress={onPress}>
      <HStack spacing={8}>
        <UIText modifiers={[foregroundStyle({ type: 'hierarchical', style: 'primary' })]}>
          {label}
        </UIText>
        <Spacer />
        <UIText
          modifiers={[
            foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
            lineLimit(1),
            truncationMode('head'),
          ]}
        >
          {value}
        </UIText>
        <Image systemName="chevron.right" size={12} color={theme.colors.mutedForeground} />
      </HStack>
    </Button>
  );
}
