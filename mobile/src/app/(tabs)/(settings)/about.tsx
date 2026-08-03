import {
  Host,
  HStack,
  Image,
  LabeledContent,
  Link,
  Section,
  Spacer,
  Text as UIText,
} from '@expo/ui/swift-ui';
import { foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import * as Application from 'expo-application';
import { useUnistyles } from 'react-native-unistyles';

import { useApiHealth } from '@/api/hooks';
import { useSession } from '@/api/session';
import { t } from '@lingui/core/macro';
import { SettingsForm } from '@/components/settings-form';

/** Same source of truth as web/src/lib/aboutContent.ts. */
const REPO_URL = 'https://github.com/sinhong2011/TraderMemos';
const DEVELOPER_NAME = 'sinhong2011';
const DEVELOPER_GITHUB = 'https://github.com/sinhong2011';

/**
 * About (web AboutTab essentials): app + API versions, server health, GitHub
 * links. The web tab's update checker and marketing blocks (features, stack,
 * philosophy) stay web-only — native updates ship through the App Store.
 */
export default function AboutScreen() {
  const { theme } = useUnistyles();
  const { session } = useSession();
  const health = useApiHealth();
  const healthOk = health.isSuccess && health.data.status === 'ok';

  const appVersion = Application.nativeApplicationVersion ?? '1.0.0';
  const build = Application.nativeBuildVersion;
  const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });

  return (
    <Host style={{ flex: 1 }}>
      <SettingsForm>
        <Section title={t`App`}>
          <LabeledContent label={t`Version`}>
            <UIText modifiers={[secondary]}>
              {build ? `${appVersion} (${build})` : appVersion}
            </UIText>
          </LabeledContent>
          <Link destination={REPO_URL}>
            <HStack spacing={8}>
              {/* SF Symbols ships no brand logos, so the repo row wears the
                  code glyph Apple's own UI uses for source links rather than
                  bundling GitHub's trademark asset. */}
              <Image
                systemName="chevron.left.forwardslash.chevron.right"
                size={15}
                color={theme.colors.mutedForeground}
              />
              <UIText>{t`GitHub repository`}</UIText>
              <Spacer />
              <Image systemName="arrow.up.right" size={12} color={theme.colors.mutedForeground} />
            </HStack>
          </Link>
          <Link destination={`${REPO_URL}/issues`}>
            <HStack spacing={8}>
              <Image systemName="ladybug" size={15} color={theme.colors.mutedForeground} />
              <UIText>{t`Report an issue`}</UIText>
              <Spacer />
              <Image systemName="arrow.up.right" size={12} color={theme.colors.mutedForeground} />
            </HStack>
          </Link>
        </Section>

        <Section title={t`Server`}>
          <LabeledContent label={t`Server URL`}>
            <UIText modifiers={[secondary]}>{session?.serverUrl ?? t`Not connected`}</UIText>
          </LabeledContent>
          <LabeledContent label={t`Status`}>
            <UIText
              modifiers={[
                foregroundStyle(
                  health.isPending
                    ? theme.colors.mutedForeground
                    : healthOk
                      ? theme.colors.profit
                      : theme.colors.loss,
                ),
              ]}
            >
              {health.isPending ? t`Checking…` : healthOk ? t`Online` : t`Unreachable`}
            </UIText>
          </LabeledContent>
          {health.data?.version ? (
            <LabeledContent label={t`API version`}>
              <UIText modifiers={[secondary]}>
                {health.data.commit
                  ? `${health.data.version} (${health.data.commit.slice(0, 7)})`
                  : health.data.version}
              </UIText>
            </LabeledContent>
          ) : null}
          {health.data?.go ? (
            <LabeledContent label={t`Go runtime`}>
              <UIText modifiers={[secondary]}>{health.data.go}</UIText>
            </LabeledContent>
          ) : null}
        </Section>

        <Section
          title={t`Developer`}
          footer={
            <UIText>{t`TraderMemos is a self-hosted trading journal — your data stays on your server.`}</UIText>
          }
        >
          <Link destination={DEVELOPER_GITHUB}>
            <HStack spacing={8}>
              <Image
                systemName="person.crop.circle"
                size={15}
                color={theme.colors.mutedForeground}
              />
              <UIText>{DEVELOPER_NAME}</UIText>
              <Spacer />
              <Image systemName="arrow.up.right" size={12} color={theme.colors.mutedForeground} />
            </HStack>
          </Link>
        </Section>
      </SettingsForm>
    </Host>
  );
}
