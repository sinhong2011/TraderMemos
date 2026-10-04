import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { cn, Frame, Text, Textarea } from 'panelui-native';
import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useCSSVariable } from 'uniwind';

import { queryKeys, useApiRequest, useLlmSettings, type LlmKind } from '@/api/hooks';
import type { LlmApiSettings, LlmApiTestResult, LlmModelsResult } from '@/api/types';
import { CenteredButton } from '@/components/centered-button';
import { ErrorState } from '@/components/error-state';
import { FormField } from '@/components/form-kit';
import { HeaderIconButton } from '@/components/header-icon-button';
import { Icon } from '@/components/icon';
import { ModelPicker } from '@/components/model-picker';
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
  // Always refetched on open: the form below copies these values into its
  // own state once, so whatever is in hand at mount is what Save writes back.
  const settings = useLlmSettings(kind, { staleTime: 0 });

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

  // The persisted snapshot can predate a change made elsewhere (web, another
  // server) — seeded from it, the form showed a stale base URL and its Save
  // would have written it back. Wait for this visit's fetch; if that fails,
  // the snapshot is the best there is.
  if (!settings.data || (!settings.isFetchedAfterMount && settings.isFetching)) {
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
  const [profit, destructive] = useCSSVariable(['--color-profit', '--color-destructive']) as [
    string,
    string,
  ];

  const [enabled, setEnabled] = useState(settings.enabled);
  const [baseUrl, setBaseUrl] = useState(settings.base_url.trim() || DEFAULT_BASE_URL);
  const [model, setModel] = useState(settings.model.trim());
  // Empty means "keep the stored key" — the server only ever returns a hint.
  const [apiKey, setApiKey] = useState('');
  const promptText = useRef(settings.custom_prompt ?? '');
  const [dirty, setDirty] = useState(false);
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

  // A query rather than a mutation so the listing is cached (and persisted)
  // per endpoint: the picker opens on the last list instead of an empty one.
  // Never fetched on mount — opening the picker refreshes it.
  //
  // The fetch never throws. A refetch that rejects flips a v5 query to
  // status 'error' even with data in hand, and the persister only keeps
  // 'success' queries — one failed refresh would wipe the saved list on the
  // next cold start. So a failure keeps the previous list and rides along as
  // `error` instead.
  const modelsKey = queryKeys.llmModels(kind, baseUrl.trim());
  const modelsQuery = useQuery({
    queryKey: modelsKey,
    queryFn: async (): Promise<{ models: string[]; error?: string }> => {
      const previous =
        queryClient.getQueryData<{ models: string[] }>(modelsKey)?.models ?? [];
      try {
        const result = await api<LlmModelsResult>(`/settings/${kind}/models`, {
          method: 'POST',
          body: {
            base_url: baseUrl.trim(),
            ...(apiKey.trim() ? { api_key: apiKey.trim() } : {}),
          },
        });
        if (result.error) return { models: previous, error: result.error };
        return { models: result.models };
      } catch (err) {
        return { models: previous, error: errorMessage(err) };
      }
    },
    enabled: false,
    retry: false,
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

          <ModelPicker
            value={model}
            models={modelsQuery.data?.models}
            loading={modelsQuery.isFetching}
            // A stale error from the persisted snapshot would flash while the
            // refresh it describes is already being retried.
            error={modelsQuery.isFetching ? undefined : modelsQuery.data?.error}
            visionOnly={kind === 'ocr'}
            onOpen={() => void modelsQuery.refetch()}
            onChange={pickModel}
          />

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

        {/* An input, so it takes the form-kit anatomy — bare on the
            background, not floated inside a section card. */}
        <FormField label={t`Prompt`}>
          <Textarea
            variant="filled"
            className="rounded-3xl border-0"
            defaultValue={settings.custom_prompt ?? ''}
            placeholder={t`Leave blank to use the built-in prompt`}
            description={copy.promptHint}
            rows={3}
            autoGrow
            maxRows={10}
            accessibilityLabel={t`Prompt`}
            onChangeText={(text) => {
              promptText.current = text;
              setDirty(true);
            }}
          />
        </FormField>
      </SettingsForm>
      {promptElement}
    </>
  );
}
