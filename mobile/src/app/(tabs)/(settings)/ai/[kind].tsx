import {
  Button,
  Divider,
  HStack,
  Image,
  Menu,
  ProgressView,
  Section,
  Spacer,
  Text as UIText,
  TextField,
  Toggle,
  useNativeState,
} from '@expo/ui/swift-ui';
import {
  Animation,
  animation,
  buttonStyle,
  controlSize,
  disabled as disabledModifier,
  foregroundStyle,
  lineLimit,
  listRowBackground,
  listRowInsets,
  progressViewStyle,
  scrollDismissesKeyboard,
  tint,
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
import { ErrorState } from '@/components/error-state';
import { HeaderIconButton } from '@/components/header-icon-button';
import { SettingsForm } from '@/components/settings-form';
import { errorMessage } from '@/lib/errors';
import { notify } from '@/lib/haptics';
import { t } from '@lingui/core/macro';
import { AppHost } from '@/components/app-host';

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

/**
 * Settle for the connection verdict.
 *
 * Long and soft on purpose: this row is the answer to a question you asked, so
 * it should be seen arriving rather than appear already-there. Damping is
 * below TAB_SPRING's 0.85 to leave a little overshoot — at high damping a
 * short spring is indistinguishable from a cut. SwiftUI takes seconds here,
 * not the milliseconds Reanimated wants.
 */
const RESULT_SPRING = { duration: 0.65, dampingFraction: 0.72 } as const;

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
      <AppHost style={{ flex: 1 }}>
        <Stack.Screen options={{ title: copy.title }} />
        <SettingsForm>
          <Section>
            <UIText modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
              {t`Loading…`}
            </UIText>
          </Section>
        </SettingsForm>
      </AppHost>
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
    <AppHost style={{ flex: 1 }}>
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

        {/* Animating the *section* is what makes the verdict row slide in and
            out: the row is conditionally mounted, and SwiftUI can only animate
            an insertion from the container that gains it. Keyed on presence,
            so a re-test (which clears the row before the new answer lands)
            plays out rather than snapping.

            `dampingFraction` matches TAB_SPRING's 0.85; the duration is
            shorter because one row settling should not take as long as a page
            transition. */}
        <Section
          modifiers={[animation(Animation.spring(RESULT_SPRING), testResult != null)]}
          title={t`Connection`}
          footer={
            <UIText>{t`Any OpenAI-compatible endpoint works. Test uses the values above, saved or not.`}</UIText>
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
          {/* The verdict belongs to the fields it tested, so it reads as the
              last row of the Connection card rather than an annotation on the
              button — which now sits outside the form entirely. */}
          {testResult ? (
            <HStack spacing={10}>
              <Image
                systemName={
                  testResult.ok ? 'checkmark.circle.fill' : 'exclamationmark.triangle.fill'
                }
                size={17}
                color={testResult.ok ? theme.colors.profit : theme.colors.destructive}
              />
              <UIText
                modifiers={[
                  foregroundStyle(testResult.ok ? theme.colors.profit : theme.colors.destructive),
                ]}
              >
                {testResult.message}
              </UIText>
              <Spacer />
            </HStack>
          ) : null}
        </Section>

        {/* Outside the Connection card: this is an action on those fields,
            not another field, and the prominent fill fought the inset-grouped
            rows it used to sit among. `listRowBackground` transparent with no
            insets is what keeps it out — a Section still paints its own card
            otherwise, which would just move the button into a second one.

            A label that merely reads "Testing…" leaves the button looking idle
            on a slow endpoint — exactly when feedback matters. Spinner plus a
            disabled button: the spin is the only thing on screen that proves
            the request is still in flight. */}
        <Section
          modifiers={[listRowBackground('transparent'), listRowInsets({ leading: 0, trailing: 0 })]}
        >
          <Button
            onPress={() => {
              setTestResult(null);
              test.mutate();
            }}
            modifiers={[
              buttonStyle('borderedProminent'),
              // Explicit tint: `borderedProminent` fills with the ambient
              // accent, and SettingsForm deliberately sets none — leaving the
              // capsule white with a white label.
              tint(theme.colors.primary),
              controlSize('large'),
              disabledModifier(test.isPending),
            ]}
          >
            <HStack spacing={8}>
              <Spacer />
              {test.isPending ? (
                // Explicitly circular: an indeterminate ProgressView inside a
                // Form otherwise renders as a full-width linear bar.
                <ProgressView
                  modifiers={[progressViewStyle('circular'), tint(theme.colors.primaryForeground)]}
                />
              ) : null}
              <UIText modifiers={[foregroundStyle(theme.colors.primaryForeground)]}>
                {test.isPending ? t`Testing…` : t`Test connection`}
              </UIText>
              <Spacer />
            </HStack>
          </Button>

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
    </AppHost>
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
