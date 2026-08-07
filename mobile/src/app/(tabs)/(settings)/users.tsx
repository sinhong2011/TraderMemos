import { Button, Section, Text as UIText } from '@expo/ui/swift-ui';
import { foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import { useRouter } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';

import { useAdminUsers, useMe } from '@/api/hooks';
import { AppHost } from '@/components/app-host';
import { CenteredButton } from '@/components/centered-button';
import { NavRow } from '@/components/nav-row';
import { SettingsForm } from '@/components/settings-form';
import { describeError } from '@/lib/errors';
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
  // Named rather than hardcoded: a server this phone can't reach and a server
  // that refused the request are different problems, and only one of them is
  // worth a Try again. Only when the list is empty though — a persisted cache
  // outlives the outage, and those accounts are still worth reading.
  const failure = users.isError && users.data == null ? describeError(users.error) : null;

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
              {failure ? <UIText modifiers={[secondary]}>{failure.title}</UIText> : null}
              {failure?.retryable ? (
                <Button
                  systemImage="arrow.clockwise"
                  label={t`Try again`}
                  onPress={() => void users.refetch()}
                />
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
