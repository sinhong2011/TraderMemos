import {
  Button,
  Host,
  HStack,
  Image,
  Section,
  Spacer,
  Text as UIText,
  VStack,
} from '@expo/ui/swift-ui';
import { font, foregroundStyle, lineLimit, truncationMode } from '@expo/ui/swift-ui/modifiers';
import { useRouter } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';

import { useLlmSettings, type LlmKind } from '@/api/hooks';
import type { LlmApiSettings } from '@/api/types';
import { SettingsForm } from '@/components/settings-form';
import { t } from '@lingui/core/macro';

/**
 * AI hub. The two integrations (vision scan, AI coach) take the same six
 * settings, so listing both on one screen meant a duplicated wall of URL and
 * key fields — instead each is one status row that pushes its own form
 * (`ai/[kind]`), the iOS Settings depth idiom. The row answers the only
 * questions worth answering at a glance: is it on, and on which model.
 */
export default function AiSettingsScreen() {
  return (
    <Host style={{ flex: 1 }}>
      <SettingsForm>
        <Section
          title={t`Intelligence`}
          footer={
            <UIText>
              {t`Vision scan reads broker screenshots into executions on Import. AI coach reviews your journal and trades to surface patterns. Both work with any OpenAI-compatible API, and keys stay on your server.`}
            </UIText>
          }
        >
          <ProviderRow kind="ocr" title={t`Vision scan`} systemImage="text.viewfinder" />
          <ProviderRow kind="coach" title={t`AI coach`} systemImage="brain" />
        </Section>
      </SettingsForm>
    </Host>
  );
}

/** Trailing state word plus the detail line under the title. */
function rowState(
  settings: LlmApiSettings,
  mutedColor: string,
  onColor: string,
  actionColor: string,
) {
  // Unconfigured is an invitation, not an error — brand tint, not destructive.
  if (!settings.api_key_set) {
    return { status: t`Set up`, statusColor: actionColor, detail: t`No API key yet` };
  }
  const model = settings.model.trim();
  const detail = model || t`Default model`;
  return settings.enabled
    ? { status: t`On`, statusColor: onColor, detail }
    : { status: t`Off`, statusColor: mutedColor, detail };
}

function ProviderRow({
  kind,
  title,
  systemImage,
}: {
  kind: LlmKind;
  title: string;
  systemImage: 'text.viewfinder' | 'brain';
}) {
  const router = useRouter();
  const { theme } = useUnistyles();
  const settings = useLlmSettings(kind);

  const state = settings.data
    ? rowState(
        settings.data,
        theme.colors.mutedForeground,
        theme.colors.profit,
        theme.colors.primary,
      )
    : {
        status: '',
        statusColor: theme.colors.mutedForeground,
        detail: settings.isError ? t`Unavailable` : t`Loading…`,
      };

  return (
    <Button onPress={() => router.push({ pathname: '/ai/[kind]', params: { kind } })}>
      <HStack spacing={10}>
        <Image systemName={systemImage} size={20} color={theme.colors.primary} />
        <VStack alignment="leading" spacing={2}>
          <UIText modifiers={[foregroundStyle({ type: 'hierarchical', style: 'primary' })]}>
            {title}
          </UIText>
          {/* Single string child — the SwiftUI Text bridge can't mount an
              array of interpolations (RawText crash). */}
          <UIText
            modifiers={[
              font({ size: 13 }),
              foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
              lineLimit(1),
              truncationMode('middle'),
            ]}
          >
            {state.detail}
          </UIText>
        </VStack>
        <Spacer />
        {state.status ? (
          <UIText modifiers={[font({ size: 15 }), foregroundStyle(state.statusColor)]}>
            {state.status}
          </UIText>
        ) : null}
        <Image systemName="chevron.right" size={12} color={theme.colors.mutedForeground} />
      </HStack>
    </Button>
  );
}
