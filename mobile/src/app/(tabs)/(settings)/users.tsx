import { useRouter } from 'expo-router';
import { Frame, Text } from 'panelui-native';

import { useAdminUsers, useMe } from '@/api/hooks';
import { CenteredButton } from '@/components/centered-button';
import { NavRow } from '@/components/nav-row';
import { SettingsForm } from '@/components/settings-form';
import { SettingsButton, SettingsSection } from '@/components/settings-rows';
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
  const router = useRouter();
  const me = useMe();
  const isOwner = me.data?.is_admin ?? false;
  const users = useAdminUsers(isOwner);

  // Named rather than hardcoded: a server this phone can't reach and a server
  // that refused the request are different problems, and only one of them is
  // worth a Try again. Only when the list is empty though — a persisted cache
  // outlives the outage, and those accounts are still worth reading.
  const failure = users.isError && users.data == null ? describeError(users.error) : null;

  return (
    <SettingsForm>
      {!isOwner ? (
        <SettingsSection title={t`Users`}>
          <Frame.Row>
            <Text size="sm" muted className="flex-1">
              {t`Only an owner can manage the accounts on this server.`}
            </Text>
          </Frame.Row>
        </SettingsSection>
      ) : (
        <>
          <SettingsSection
            title={t`People`}
            footer={t`Members see only their own trades. Owners can also add and remove accounts here.`}
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
              <Frame.Row>
                <Text size="sm" muted className="flex-1">
                  {t`No accounts yet`}
                </Text>
              </Frame.Row>
            ) : null}
            {users.isLoading ? (
              <Frame.Row>
                <Text size="sm" muted className="flex-1">
                  {t`Loading…`}
                </Text>
              </Frame.Row>
            ) : null}
            {failure ? (
              <Frame.Row>
                <Text size="sm" muted className="flex-1">
                  {failure.title}
                </Text>
              </Frame.Row>
            ) : null}
            {failure?.retryable ? (
              <SettingsButton
                systemImage="arrow.clockwise"
                label={t`Try again`}
                onPress={() => void users.refetch()}
              />
            ) : null}
          </SettingsSection>

          {/* Outside a section card: a standalone action is not another row,
              and a filled button inside the panel would fight its corners. */}
          <CenteredButton label={t`Add user`} onPress={() => router.push('/user-form')} />
        </>
      )}
    </SettingsForm>
  );
}
