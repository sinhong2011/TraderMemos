import { LabeledContent, Section, Text as UIText, Toggle } from '@expo/ui/swift-ui';
import { foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { Alert } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import { queryKeys, useAdminUsers, useApiRequest, useMe } from '@/api/hooks';
import type { AdminUser } from '@/api/types';
import { AppHost } from '@/components/app-host';
import { CenteredButton } from '@/components/centered-button';
import { NavRow } from '@/components/nav-row';
import { SettingsForm } from '@/components/settings-form';
import { useFormatters } from '@/lib/format';
import { notify } from '@/lib/haptics';
import { t } from '@lingui/core/macro';

/** Matches the server's `auth.MinPasswordLen`. */
const MIN_LENGTH = 10;

/**
 * One account, from an owner's side: role, a password reset, and deletion.
 *
 * The user is read out of the list query rather than fetched — there is no
 * per-user GET, and coming here always means coming through the list.
 */
export default function UserDetailScreen() {
  const { theme } = useUnistyles();
  const { formatDate } = useFormatters();
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApiRequest();
  const me = useMe();
  const { id } = useLocalSearchParams<{ id: string }>();

  const users = useAdminUsers(me.data?.is_admin ?? false);
  const user = (users.data ?? []).find((u) => u.id === id);
  const isSelf = user?.id === me.data?.id;

  const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' as const });

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
      Alert.alert(t`Could not change role`, err.message);
      refreshUsers();
    },
  });

  const resetPassword = useMutation({
    mutationFn: (next: string) =>
      api<void>(`/admin/users/${id}/password`, {
        method: 'POST',
        body: { new_password: next },
      }),
    onSuccess: () => {
      notify('success');
      Alert.alert(
        t`Password reset`,
        t`${user?.email ?? ''} signs in with the new password. Their other devices are signed out.`,
      );
    },
    onError: (err) => {
      notify('error');
      Alert.alert(t`Could not reset password`, err.message);
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
      Alert.alert(t`Could not delete user`, err.message);
    },
  });

  function promptReset() {
    // One value, so `Alert.prompt` rather than a pushed form — the settings
    // idiom this app already uses for single-field edits. Plain text, not
    // secure: an owner has to read the temporary password back to whoever
    // they are resetting it for.
    Alert.prompt(
      t`Reset password`,
      t`Sets a new password for ${user?.email ?? ''} without their current one.`,
      [
        { text: t`Cancel`, style: 'cancel' },
        {
          text: t`Reset`,
          onPress: (value?: string) => {
            const next = value ?? '';
            if (next.length < MIN_LENGTH) {
              Alert.alert(t`Could not reset password`, t`Use at least ${MIN_LENGTH} characters.`);
              return;
            }
            resetPassword.mutate(next);
          },
        },
      ],
      'plain-text',
    );
  }

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
      <AppHost style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <SettingsForm>
          <Section>
            <UIText modifiers={[secondary]}>
              {users.isLoading ? t`Loading…` : t`This account no longer exists.`}
            </UIText>
          </Section>
        </SettingsForm>
      </AppHost>
    );
  }

  return (
    <AppHost style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Stack.Screen options={{ title: user.email }} />
      <SettingsForm>
        <Section title={t`Account`}>
          <LabeledContent label={t`Username`}>
            <UIText>{user.email}</UIText>
          </LabeledContent>
          <LabeledContent label={t`Member since`}>
            <UIText>{formatDate(user.created_at)}</UIText>
          </LabeledContent>
          <LabeledContent label={t`Two-factor`}>
            <UIText>{user.totp_enabled ? t`On` : t`Off`}</UIText>
          </LabeledContent>
        </Section>

        <Section
          footer={
            <UIText>
              {isSelf
                ? t`You are an owner. The last owner cannot be demoted — promote someone else first.`
                : t`Owners can add, remove and reset every account on this server, including yours.`}
            </UIText>
          }
        >
          <Toggle
            label={t`Owner`}
            isOn={user.is_admin}
            onIsOnChange={(value) => setRole.mutate(value)}
          />
        </Section>

        <Section
          title={t`Security`}
          footer={<UIText>{t`A reset signs out that user's other devices.`}</UIText>}
        >
          <NavRow
            systemImage="lock.rotation"
            label={t`Reset password`}
            accessory="none"
            onPress={promptReset}
          />
        </Section>

        {/* Your own account is deleted from nowhere — the server refuses it
            here, and the account screen owns the choices that are yours. */}
        {isSelf ? null : (
          <Section>
            <CenteredButton
              role="destructive"
              label={t`Delete user`}
              disabled={remove.isPending}
              onPress={confirmDelete}
            />
          </Section>
        )}
      </SettingsForm>
    </AppHost>
  );
}
