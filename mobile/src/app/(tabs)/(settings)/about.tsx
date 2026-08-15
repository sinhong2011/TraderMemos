import * as Application from 'expo-application';
import { Linking } from 'react-native';

import { useApiHealth } from '@/api/hooks';
import { useSession } from '@/api/session';
import { t } from '@lingui/core/macro';
import { NavRow } from '@/components/nav-row';
import { SettingsForm } from '@/components/settings-form';
import { SettingsRow, SettingsSection, ValueText } from '@/components/settings-rows';
import { usePnlPalette } from '@/styles/pnl';

/** Same source of truth as web/src/lib/aboutContent.ts. */
const REPO_URL = 'https://github.com/sinhong2011/TraderMemos';
const DEVELOPER_NAME = 'sinhong2011';
const DEVELOPER_GITHUB = 'https://github.com/sinhong2011';

/**
 * About (web AboutTab essentials): app + API versions, server health, GitHub
 * links. The web tab's update checker and marketing blocks (features, stack,
 * philosophy) stay web-only — native updates ship through the stores.
 *
 * Built on the shared settings vocabulary; the GitHub rows are
 * `NavRow accessory="external"` (the leaving glyph, per the NavRow doc) with
 * `Linking.openURL`.
 */
export default function AboutScreen() {
  // Server health reads in the P&L hues — green for reachable, red for not —
  // so it takes the same live palette every other verdict in the app does.
  const palette = usePnlPalette();
  const { session } = useSession();
  const health = useApiHealth();
  const healthOk = health.isSuccess && health.data.status === 'ok';

  const appVersion = Application.nativeApplicationVersion ?? '1.0.0';
  const build = Application.nativeBuildVersion;

  return (
    <SettingsForm>
      <SettingsSection title={t`App`}>
        <SettingsRow label={t`Version`}>
          <ValueText>{build ? `${appVersion} (${build})` : appVersion}</ValueText>
        </SettingsRow>
        {/* SF Symbols ships no brand logos, so the repo row wears the code
            glyph Apple's own UI uses for source links rather than bundling
            GitHub's trademark asset. */}
        <NavRow
          systemImage="chevron.left.forwardslash.chevron.right"
          label={t`GitHub repository`}
          accessory="external"
          onPress={() => void Linking.openURL(REPO_URL)}
        />
        <NavRow
          systemImage="ladybug"
          label={t`Report an issue`}
          accessory="external"
          onPress={() => void Linking.openURL(`${REPO_URL}/issues`)}
        />
      </SettingsSection>

      <SettingsSection title={t`Server`}>
        <SettingsRow label={t`Server URL`}>
          <ValueText>{session?.serverUrl ?? t`Not connected`}</ValueText>
        </SettingsRow>
        <SettingsRow label={t`Status`}>
          {/* The failure word is describeError's, not this screen's — About
              and the error states must not name the same thing differently.
              A pending check takes no color at all, which is the muted value
              color every other row reads in. */}
          <ValueText
            color={health.isPending ? undefined : healthOk ? palette.profit : palette.loss}
          >
            {health.isPending ? t`Checking…` : healthOk ? t`Online` : t`Can't reach the server`}
          </ValueText>
        </SettingsRow>
        {health.data?.version ? (
          <SettingsRow label={t`API version`}>
            <ValueText>
              {health.data.commit
                ? `${health.data.version} (${health.data.commit.slice(0, 7)})`
                : health.data.version}
            </ValueText>
          </SettingsRow>
        ) : null}
        {health.data?.go ? (
          <SettingsRow label={t`Go runtime`}>
            <ValueText>{health.data.go}</ValueText>
          </SettingsRow>
        ) : null}
      </SettingsSection>

      <SettingsSection
        title={t`Developer`}
        footer={t`TraderMemos is a self-hosted trading journal — your data stays on your server.`}
      >
        <NavRow
          systemImage="person.crop.circle"
          label={DEVELOPER_NAME}
          accessory="external"
          onPress={() => void Linking.openURL(DEVELOPER_GITHUB)}
        />
      </SettingsSection>
    </SettingsForm>
  );
}
