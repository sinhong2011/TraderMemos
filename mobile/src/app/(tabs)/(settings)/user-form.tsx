import { LabeledContent, Section, Text as UIText, TextField, Toggle, useNativeState } from '@expo/ui/swift-ui';
import { multilineTextAlignment, scrollDismissesKeyboard } from '@expo/ui/swift-ui/modifiers';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import { queryKeys, useApiRequest } from '@/api/hooks';
import type { AdminUser } from '@/api/types';
import { AppHost } from '@/components/app-host';
import { HeaderIconButton } from '@/components/header-icon-button';
import { SettingsForm } from '@/components/settings-form';
import { notify } from '@/lib/haptics';
import { t } from '@lingui/core/macro';

/** Matches the server's `auth.MinPasswordLen`. */
const MIN_LENGTH = 10;

/**
 * Add a user to this server.
 *
 * The password is a plain `TextField`, not a `SecureField`, on purpose: an
 * owner has to read the temporary one back to the person they just created,
 * and nobody can memorise dots. Creating a user here works whether or not open
 * registration is enabled — that gate is about the internet, not the owner.
 */
export default function UserFormScreen() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApiRequest();

  const usernameState = useNativeState('');
  const username = useRef('');
  const passwordState = useNativeState('');
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
      Alert.alert(t`Could not add user`, err.message);
    },
  });

  function submit() {
    if (password.current.length < MIN_LENGTH) {
      Alert.alert(t`Could not add user`, t`Use at least ${MIN_LENGTH} characters.`);
      return;
    }
    create.mutate();
  }

  const trailing = multilineTextAlignment('trailing');

  return (
    <AppHost style={{ flex: 1, backgroundColor: theme.colors.background }}>
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
      <SettingsForm modifiers={[scrollDismissesKeyboard('immediately')]}>
        <Section
          title={t`New user`}
          footer={
            <UIText>{t`Hand the password over out of band — they can change it from their own account screen.`}</UIText>
          }
        >
          <LabeledContent label={t`Username`}>
            <TextField
              placeholder={t`e.g. alex`}
              text={usernameState}
              onTextChange={(text) => {
                username.current = text;
                refresh();
              }}
              modifiers={[trailing]}
            />
          </LabeledContent>
          <LabeledContent label={t`Password`}>
            <TextField
              placeholder={t`At least ${MIN_LENGTH} characters`}
              text={passwordState}
              onTextChange={(text) => {
                password.current = text;
                refresh();
              }}
              modifiers={[trailing]}
            />
          </LabeledContent>
        </Section>

        <Section
          footer={
            <UIText>{t`Owners can add, remove and reset every account on this server, including yours.`}</UIText>
          }
        >
          <Toggle label={t`Owner`} isOn={isOwner} onIsOnChange={setIsOwner} />
        </Section>
      </SettingsForm>
    </AppHost>
  );
}
