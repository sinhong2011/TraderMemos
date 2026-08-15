import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useRef, useState } from 'react';
import { Alert } from 'react-native';

import { queryKeys, useApiRequest } from '@/api/hooks';
import type { AdminUser } from '@/api/types';
import { HeaderIconButton } from '@/components/header-icon-button';
import { SettingsForm } from '@/components/settings-form';
import { SettingsInput, SettingsSection, SettingsToggle } from '@/components/settings-rows';
import { errorMessage } from '@/lib/errors';
import { notify } from '@/lib/haptics';
import { t } from '@lingui/core/macro';

/** Matches the server's `auth.MinPasswordLen`. */
const MIN_LENGTH = 10;

/**
 * Add a user to this server.
 *
 * The password is a plain field, not a masked one, on purpose: an owner has to
 * read the temporary one back to the person they just created, and nobody can
 * memorise dots. Creating a user here works whether or not open registration
 * is enabled — that gate is about the internet, not the owner.
 */
export default function UserFormScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApiRequest();

  // The fields own their text after mount; the refs are what submit reads.
  const username = useRef('');
  const password = useRef('');
  const [isOwner, setIsOwner] = useState(false);
  // Only the submit-enabled question needs to re-render on a keystroke.
  const [filled, setFilled] = useState(false);

  function refresh() {
    setFilled(username.current.trim() !== '' && password.current !== '');
  }

  const create = useMutation({
    mutationFn: () =>
      api<AdminUser>('/admin/users', {
        method: 'POST',
        body: {
          email: username.current.trim(),
          password: password.current,
          is_admin: isOwner,
        },
      }),
    onSuccess: (user) => {
      notify('success');
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers() });
      router.back();
      Alert.alert(
        t`User added`,
        t`${user.email} can sign in to this server with the password you set.`,
      );
    },
    onError: (err) => {
      notify('error');
      Alert.alert(t`Could not add user`, errorMessage(err));
    },
  });

  function submit() {
    if (password.current.length < MIN_LENGTH) {
      Alert.alert(t`Could not add user`, t`Use at least ${MIN_LENGTH} characters.`);
      return;
    }
    create.mutate();
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <HeaderIconButton
              systemImage="checkmark"
              disabled={!filled || create.isPending}
              label={create.isPending ? t`Adding…` : t`Add`}
              onPress={submit}
            />
          ),
        }}
      />
      <SettingsForm>
        <SettingsSection
          title={t`New user`}
          footer={t`Hand the password over out of band — they can change it from their own account screen.`}
        >
          <SettingsInput
            label={t`Username`}
            placeholder={t`e.g. alex`}
            onChangeText={(text) => {
              username.current = text;
              refresh();
            }}
          />
          <SettingsInput
            label={t`Password`}
            placeholder={t`At least ${MIN_LENGTH} characters`}
            onChangeText={(text) => {
              password.current = text;
              refresh();
            }}
          />
        </SettingsSection>

        <SettingsSection
          footer={t`Owners can add, remove and reset every account on this server, including yours.`}
        >
          <SettingsToggle label={t`Owner`} value={isOwner} onValueChange={setIsOwner} />
        </SettingsSection>
      </SettingsForm>
    </>
  );
}
