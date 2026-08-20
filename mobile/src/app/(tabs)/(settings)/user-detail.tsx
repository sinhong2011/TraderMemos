import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { Frame, Text } from 'panelui-native';
import { Alert } from 'react-native';

import { queryKeys, useAdminUsers, useApiRequest, useMe } from '@/api/hooks';
import type { AdminUser } from '@/api/types';
import { CenteredButton } from '@/components/centered-button';
import { NavRow } from '@/components/nav-row';
import { SettingsForm } from '@/components/settings-form';
import { SettingsRow, SettingsSection, SettingsToggle, ValueText } from '@/components/settings-rows';
import { errorMessage } from '@/lib/errors';
import { useFormatters } from '@/lib/format';
import { notify } from '@/lib/haptics';
import { t } from '@lingui/core/macro';

/**
 * One account, from an owner's side: role, a password reset, and deletion.
 *
 * The user is read out of the list query rather than fetched — there is no
 * per-user GET, and coming here always means coming through the list.
 */
export default function UserDetailScreen() {
  const { formatDate } = useFormatters();
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApiRequest();
  const me = useMe();
  const { id } = useLocalSearchParams<{ id: string }>();

  const users = useAdminUsers(me.data?.is_admin ?? false);
  const user = (users.data ?? []).find((u) => u.id === id);
  const isSelf = user?.id === me.data?.id;

  function refreshUsers() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers() });
  }

  const setRole = useMutation({
    mutationFn: (isAdmin: boolean) =>
      api<AdminUser>(`/admin/users/${id}`, { method: 'PATCH', body: { is_admin: isAdmin } }),
    onSuccess: () => {
      notify('success');
      refreshUsers();
      // Demoting yourself changes what you are allowed to see, this screen
      // included.
      if (isSelf) void queryClient.invalidateQueries({ queryKey: queryKeys.me() });
    },
    onError: (err) => {
      notify('error');
      // The server refuses to strip the last owner — surfacing why beats a
      // toggle that silently springs back.
      Alert.alert(t`Could not change role`, errorMessage(err));
      refreshUsers();
    },
  });

  const remove = useMutation({
    mutationFn: () => api<void>(`/admin/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      notify('success');
      refreshUsers();
      router.back();
    },
    onError: (err) => {
      notify('error');
      Alert.alert(t`Could not delete user`, errorMessage(err));
    },
  });

  function confirmDelete() {
    // Deleting cascades their accounts, trades, notes and screenshots away.
    // Two taps and an explicit warning is what a phone can offer in place of
    // the web's type-the-name confirmation.
    Alert.alert(
      t`Delete ${user?.email ?? ''}?`,
      t`This also deletes every account, trade, note and screenshot they own. There is no undo.`,
      [
        { text: t`Cancel`, style: 'cancel' },
        { text: t`Delete`, style: 'destructive', onPress: () => remove.mutate() },
      ],
    );
  }

  if (!user) {
    return (
      <SettingsForm>
        <SettingsSection>
          <Frame.Row>
            <Text size="sm" muted className="flex-1">
              {users.isLoading ? t`Loading…` : t`This account no longer exists.`}
            </Text>
          </Frame.Row>
        </SettingsSection>
      </SettingsForm>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: user.email }} />
      <SettingsForm>
        <SettingsSection title={t`Account`}>
          <SettingsRow label={t`Username`}>
            <ValueText>{user.email}</ValueText>
          </SettingsRow>
          <SettingsRow label={t`Member since`}>
            <ValueText>{formatDate(user.created_at)}</ValueText>
          </SettingsRow>
          <SettingsRow label={t`Two-factor`}>
            <ValueText>{user.totp_enabled ? t`On` : t`Off`}</ValueText>
          </SettingsRow>
        </SettingsSection>

        <SettingsSection
          footer={isSelf
                ? t`You are an owner. The last owner cannot be demoted — promote someone else first.`
                : t`Owners can add, remove and reset every account on this server, including yours.`}
        >
          <SettingsToggle
            label={t`Owner`}
            value={user.is_admin}
            onValueChange={(value) => setRole.mutate(value)}
          />
        </SettingsSection>

        <SettingsSection
          title={t`Security`}
          footer={t`A reset signs out that user's other devices.`}
        >
          <NavRow
            systemImage="lock.rotation"
            label={t`Reset password`}
            onPress={() => router.push({ pathname: '/reset-password', params: { id } })}
          />
        </SettingsSection>

        {/* Your own account is deleted from nowhere — the server refuses it
            here, and the account screen owns the choices that are yours. */}
        {isSelf ? null : (
          <CenteredButton
            role="destructive"
            label={t`Delete user`}
            disabled={remove.isPending}
            onPress={confirmDelete}
          />
        )}
      </SettingsForm>
    </>
  );
}
