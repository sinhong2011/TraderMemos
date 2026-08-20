import { useRouter } from 'expo-router';
import type { SFSymbol } from 'expo-symbols';
import { Frame, Text } from 'panelui-native';
import { useCSSVariable } from 'uniwind';

import { useLlmSettings, type LlmKind } from '@/api/hooks';
import type { LlmApiSettings } from '@/api/types';
import { Icon } from '@/components/icon';
import { SettingsForm } from '@/components/settings-form';
import { SettingsSection } from '@/components/settings-rows';
import { t } from '@lingui/core/macro';
import { describeError } from '@/lib/errors';

/**
 * AI hub. The two integrations (vision scan, AI coach) take the same six
 * settings, so listing both on one screen meant a duplicated wall of URL and
 * key fields — instead each is one status row that pushes its own form
 * (`ai/[kind]`), the Settings depth idiom. The row answers the only questions
 * worth answering at a glance: is it on, and on which model.
 */
export default function AiSettingsScreen() {
  return (
    <SettingsForm>
      <SettingsSection
        title={t`Intelligence`}
        footer={t`Vision scan reads broker screenshots into executions on Import. AI coach reviews your journal and trades to surface patterns. Both work with any OpenAI-compatible API, and keys stay on your server.`}
      >
        <ProviderRow kind="ocr" title={t`Vision scan`} systemImage="text.viewfinder" />
        <ProviderRow kind="coach" title={t`AI coach`} systemImage="brain" />
      </SettingsSection>
    </SettingsForm>
  );
}

/** Trailing state word plus the detail line under the title. */
function rowState(settings: LlmApiSettings) {
  // Unconfigured is an invitation, not an error — brand tint, not destructive.
  if (!settings.api_key_set) {
    return { status: t`Set up`, statusClass: 'text-primary', detail: t`No API key yet` };
  }
  const model = settings.model.trim();
  const detail = model || t`Default model`;
  return settings.enabled
    ? { status: t`On`, statusClass: 'text-profit', detail }
    : { status: t`Off`, statusClass: 'text-muted-foreground', detail };
}

function ProviderRow({
  kind,
  title,
  systemImage,
}: {
  kind: LlmKind;
  title: string;
  systemImage: SFSymbol;
}) {
  const router = useRouter();
  const [foreground, mutedForeground] = useCSSVariable([
    '--color-foreground',
    '--color-muted-foreground',
  ]) as [string, string];
  const settings = useLlmSettings(kind);

  const state = settings.data
    ? rowState(settings.data)
    : {
        status: '',
        statusClass: 'text-muted-foreground',
        // "Unavailable" said nothing about which of the two things is
        // unavailable — the integration or the server holding its settings.
        detail: settings.isError ? describeError(settings.error).title : t`Loading…`,
      };

  return (
    <Frame.Row onPress={() => router.push({ pathname: '/ai/[kind]', params: { kind } })}>
      <Frame.Media>
        <Icon name={systemImage} size={20} tintColor={foreground} />
      </Frame.Media>
      <Frame.Content>
        <Frame.Title>{title}</Frame.Title>
        <Text size="sm" muted numberOfLines={1} ellipsizeMode="middle">
          {state.detail}
        </Text>
      </Frame.Content>
      <Frame.Actions>
        {state.status ? (
          <Text size="sm" className={state.statusClass}>
            {state.status}
          </Text>
        ) : null}
        <Icon name="chevron.right" size={12} tintColor={mutedForeground} />
      </Frame.Actions>
    </Frame.Row>
  );
}
