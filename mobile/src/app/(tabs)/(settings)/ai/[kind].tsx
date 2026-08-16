import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { cn, Frame, Menu, Text, Textarea } from 'panelui-native';
import { useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useCSSVariable } from 'uniwind';

import { queryKeys, useApiRequest, useLlmSettings, type LlmKind } from '@/api/hooks';
import type { LlmApiSettings, LlmApiTestResult, LlmModelsResult } from '@/api/types';
import { CenteredButton } from '@/components/centered-button';
import { ErrorState } from '@/components/error-state';
import { HeaderIconButton } from '@/components/header-icon-button';
import { Icon } from '@/components/icon';
import { NavRow } from '@/components/nav-row';
import { SettingsForm } from '@/components/settings-form';
import { SettingsSection, SettingsToggle } from '@/components/settings-rows';
import { usePrompt } from '@/components/use-prompt';
import { errorMessage } from '@/lib/errors';
import { notify } from '@/lib/haptics';
import { t } from '@lingui/core/macro';

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

/** Sub-second round trips read better in ms; past that, one decimal second. */
function formatLatency(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

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
 * One LLM endpoint (vision scan or AI coach). Values edit through prompts
 * rather than inline fields — a base URL or key is far too long for a form
 * row, and the settings idiom here is tap-a-row-to-edit. Save lives in the nav
 * bar and lights up only when something changed, so the screen has no standing
 * action rows; the connection test reports inline instead of through an alert.
 */
export default function AiProviderScreen() {
  const params = useLocalSearchParams<{ kind: string }>();
  const kind: LlmKind = params.kind === 'coach' ? 'coach' : 'ocr';
  const copy = kindCopy(kind);
  const settings = useLlmSettings(kind);

  // Nothing on this screen exists without the settings, so a failure takes the
  // whole surface — and carries the retry the old dead-end row didn't.
  if (settings.isError && !settings.data) {
    return (
      <>
        <Stack.Screen options={{ title: copy.title }} />
        <ErrorState
          error={settings.error}
          onRetry={() => void settings.refetch()}
          retrying={settings.isRefetching}
        />
      </>
    );
  }

  if (!settings.data) {
    return (
      <>
        <Stack.Screen options={{ title: copy.title }} />
        <SettingsForm>
          <SettingsSection>
            <Frame.Row>
              <Text size="sm" muted className="flex-1">
                {t`Loading…`}
              </Text>
            </Frame.Row>
          </SettingsSection>
        </SettingsForm>
      </>
    );
  }
  // Mount the form only once the settings are in cache, so every field can
  // initialize straight from them (no prefill effects).
  return <ProviderForm kind={kind} settings={settings.data} />;
}

function ProviderForm({ kind, settings }: { kind: LlmKind; settings: LlmApiSettings }) {
  const queryClient = useQueryClient();
  const api = useApiRequest();
  const copy = kindCopy(kind);
  // Single-value edits go through a prompt — the settings idiom here, and
  // `usePrompt` is its cross-platform form (`Alert.prompt` is iOS-only).
  const { prompt, element: promptElement } = usePrompt();
  const [profit, destructive, mutedForeground] = useCSSVariable([
    '--color-profit',
    '--color-destructive',
    '--color-muted-foreground',
  ]) as [string, string, string];

  const [enabled, setEnabled] = useState(settings.enabled);
  const [baseUrl, setBaseUrl] = useState(settings.base_url.trim() || DEFAULT_BASE_URL);
  const [model, setModel] = useState(settings.model.trim());
  // Empty means "keep the stored key" — the server only ever returns a hint.
  const [apiKey, setApiKey] = useState('');
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
    onError: (err) => Alert.alert(t`Could not save`, errorMessage(err)),
  });

  const test = useMutation({
    mutationFn: async () => {
      // Round-trip time is the useful half of the answer: a reachable endpoint
      // that takes four seconds is a different problem from a broken one, and
      // the API reports only ok/error.
      const startedAt = Date.now();
      const result = await api<LlmApiTestResult>(`/settings/${kind}/test`, {
        method: 'POST',
        body: connection(),
      });
      return { result, elapsedMs: Date.now() - startedAt };
    },
    onSuccess: ({ result, elapsedMs }) => {
      notify(result.ok ? 'success' : 'error');
      setTestResult({
        ok: result.ok,
        message: result.ok
          ? t`Connection OK · ${formatLatency(elapsedMs)}`
          : (result.error ?? t`The endpoint did not answer.`),
      });
    },
    onError: (err) => {
      notify('error');
      setTestResult({ ok: false, message: errorMessage(err) });
    },
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
    onError: (err) => Alert.alert(t`Could not load models`, errorMessage(err)),
  });

  function editBaseUrl() {
    prompt({
      title: t`Base URL`,
      message: t`The root of an OpenAI-compatible API, ending in /v1.`,
      defaultValue: baseUrl,
      keyboardType: 'url',
      confirmLabel: t`Done`,
      onSubmit: (text) => {
        const next = text.trim();
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
    });
  }

  function editApiKey() {
    prompt({
      title: t`API key`,
      message: settings.api_key_set
        ? t`Leave blank to keep the key already stored on the server.`
        : t`Stored on your server, never on this phone.`,
      confirmLabel: t`Done`,
      onSubmit: (text) => {
        const next = text.trim();
        if (!next) return;
        setApiKey(next);
        setTestResult(null);
        setDirty(true);
      },
    });
  }

  function editModel() {
    prompt({
      title: t`Model`,
      message: t`The model id as the endpoint spells it, e.g. gpt-4o-mini.`,
      defaultValue: model,
      confirmLabel: t`Done`,
      onSubmit: (text) => pickModel(text.trim()),
    });
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
    <>
      <Stack.Screen
        options={{
          title: copy.title,
          headerRight: () => (
            <HeaderIconButton
              systemImage="checkmark"
              disabled={!dirty || save.isPending}
              label={save.isPending ? t`Saving…` : t`Save`}
              onPress={() => save.mutate()}
            />
          ),
        }}
      />
      <SettingsForm>
        <SettingsSection footer={copy.blurb}>
          <SettingsToggle
            label={t`Enabled`}
            value={enabled}
            onValueChange={(value) => {
              setEnabled(value);
              setDirty(true);
            }}
          />
        </SettingsSection>

        <SettingsSection
          title={t`Connection`}
          footer={t`Any OpenAI-compatible endpoint works. Test uses the values above, saved or not.`}
        >
          {/* `accessory="none"`: these rows open a prompt, and a chevron
              promises a push that never happens. */}
          <NavRow label={t`Base URL`} value={baseUrl} accessory="none" onPress={editBaseUrl} />

          {/* The model row is a pull-down rather than a picker: besides the
              models the endpoint listed, it carries the two actions that
              produce that list in the first place. */}
          <Menu presentation="bottom-sheet">
            <Menu.Trigger>
              <Frame.Row accessibilityRole="button" accessibilityLabel={t`Model`}>
                <Frame.Content>
                  <Frame.Title>{t`Model`}</Frame.Title>
                </Frame.Content>
                <Frame.Actions className="min-w-0 shrink justify-end">
                  <Text size="sm" muted numberOfLines={1} ellipsizeMode="middle">
                    {model || t`Default`}
                  </Text>
                  <Icon name="chevron.up.chevron.down" size={11} tintColor={mutedForeground} />
                </Frame.Actions>
              </Frame.Row>
            </Menu.Trigger>
            <Menu.Content width="full" className="shadow-none rounded-none">
              {models.map((name) => (
                <Menu.Item
                  key={name}
                  icon={
                    name === model ? (
                      <Icon name="checkmark" size={13} tintColor={mutedForeground} />
                    ) : undefined
                  }
                  onPress={() => pickModel(name)}
                >
                  {name}
                </Menu.Item>
              ))}
              {models.length > 0 ? <Menu.Separator /> : null}
              <Menu.Item
                icon={<Icon name="arrow.down.circle" size={13} tintColor={mutedForeground} />}
                disabled={listModels.isPending}
                onPress={() => {
                  if (!listModels.isPending) listModels.mutate();
                }}
              >
                {listModels.isPending ? t`Loading models…` : t`Fetch models`}
              </Menu.Item>
              <Menu.Item
                icon={<Icon name="keyboard" size={13} tintColor={mutedForeground} />}
                onPress={editModel}
              >
                {t`Type a model id…`}
              </Menu.Item>
            </Menu.Content>
          </Menu>

          <NavRow label={t`API key`} value={apiKeyValue} accessory="none" onPress={editApiKey} />

          {/* The verdict belongs to the fields it tested, so it reads as the
              last row of the Connection card rather than an annotation on the
              button — which sits outside the form entirely. It fades in rather
              than appearing already-there: this row is the answer to a
              question that was asked. */}
          {testResult ? (
            <Animated.View
              entering={FadeIn.duration(250)}
              exiting={FadeOut.duration(150)}
              className="flex-row items-center gap-2.5 px-4 py-3.5"
            >
              <Icon
                name={testResult.ok ? 'checkmark.circle.fill' : 'exclamationmark.triangle.fill'}
                size={17}
                tintColor={testResult.ok ? profit : destructive}
              />
              <Text className={cn('flex-1', testResult.ok ? 'text-profit' : 'text-destructive')}>
                {testResult.message}
              </Text>
            </Animated.View>
          ) : null}
        </SettingsSection>

        {/* Outside the Connection card: this is an action on those fields, not
            another field. A label that merely reads "Testing…" leaves the
            button looking idle on a slow endpoint — exactly when feedback
            matters, so it spins and locks out a second tap. */}
        <CenteredButton
          label={test.isPending ? t`Testing…` : t`Test connection`}
          loading={test.isPending}
          onPress={() => {
            setTestResult(null);
            test.mutate();
          }}
        />

        <SettingsSection title={t`Prompt`} footer={copy.promptHint}>
          <View className="px-4 py-3">
            <Textarea
              defaultValue={settings.custom_prompt ?? ''}
              placeholder={t`Leave blank to use the built-in prompt`}
              rows={3}
              autoGrow
              maxRows={10}
              accessibilityLabel={t`Prompt`}
              onChangeText={(text) => {
                promptText.current = text;
                setDirty(true);
              }}
            />
          </View>
        </SettingsSection>
      </SettingsForm>
      {promptElement}
    </>
  );
}
