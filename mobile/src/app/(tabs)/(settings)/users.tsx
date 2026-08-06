import { Section, Text as UIText } from '@expo/ui/swift-ui';
import { foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import { useRouter } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';

import { useAdminUsers, useMe } from '@/api/hooks';
import { AppHost } from '@/components/app-host';
import { CenteredButton } from '@/components/centered-button';
import { NavRow } from '@/components/nav-row';
import { SettingsForm } from '@/components/settings-form';
import { t } from '@lingui/core/macro';

/**
 * Everyone with an account on this server.
 *
 * Owner-only, and the row that leads here is hidden from members — but the
 * screen still says so itself, because a deep link or a demotion mid-session
 * can land a member here.
 */
export default function UsersScreen() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const me = useMe();
  const isOwner = me.data?.is_admin ?? false;
  const users = useAdminUsers(isOwner);

  const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' as const });

  return (
    <AppHost style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <SettingsForm>
        {!isOwner ? (
          <Section title={t`Users`}>
            <UIText modifiers={[secondary]}>
              {t`Only an owner can manage the accounts on this server.`}
            </UIText>
          </Section>
        ) : (
          <>
            <Section
              title={t`People`}
              footer={
                <UIText>
                  {t`Members see only their own trades. Owners can also add and remove accounts here.`}
                </UIText>
              }
            >
              {(users.data ?? []).map((user) => (
                <NavRow
                  key={user.id}
                  systemImage={user.is_admin ? 'person.badge.key' : 'person'}
                  label={user.email}
                  value={user.id === me.data?.id ? t`You` : user.is_admin ? t`Owner` : t`Member`}
                  onPress={() => router.push({ pathname: '/user-detail', params: { id: user.id } })}
                />
              ))}
              {users.data?.length === 0 ? (
                <UIText modifiers={[secondary]}>{t`No accounts yet`}</UIText>
              ) : null}
              {users.isLoading ? <UIText modifiers={[secondary]}>{t`Loading…`}</UIText> : null}
              {users.isError ? (
                <UIText modifiers={[secondary]}>{t`Could not load users.`}</UIText>
              ) : null}
            </Section>

            <Section>
              <CenteredButton label={t`Add user`} onPress={() => router.push('/user-form')} />
            </Section>
          </>
        )}
      </SettingsForm>
    </AppHost>
  );
}
