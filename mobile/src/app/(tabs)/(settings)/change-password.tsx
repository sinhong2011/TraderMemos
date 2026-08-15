import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { Frame, Text } from 'panelui-native';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { useApiRequest } from '@/api/hooks';
import { useSession } from '@/api/session';
import type { TokenPair } from '@/api/types';
import { HeaderIconButton } from '@/components/header-icon-button';
import { PasswordInput } from '@/components/password-input';
import { SettingsForm } from '@/components/settings-form';
import { SettingsSection } from '@/components/settings-rows';
import { errorMessage } from '@/lib/errors';
import { notify } from '@/lib/haptics';
import { t } from '@lingui/core/macro';

/** Matches the server's `auth.MinPasswordLen`. */
const MIN_LENGTH = 10;

/**
 * Change your own password.
 *
 * Three masked fields rather than a prompt — `Alert.prompt` takes one value,
 * and a confirmation field is the cheapest guard against locking yourself out
 * of a self-hosted server by typo. Each one is the app's `PasswordInput`, so
 * the reveal toggle is there when a typo is the likelier explanation than a
 * wrong password.
 *
 * The server answers with a fresh token pair, because the change invalidates
 * every token minted against the old password including the one this request
 * arrived with. Persisting it is what keeps *this* device signed in while the
 * others drop.
 */
export default function ChangePasswordScreen() {
  const router = useRouter();
  const { session, signIn } = useSession();
  const api = useApiRequest();

  // The fields are drawn in JS now, so the values are simply state: the ref
  // mirrors only existed because SwiftUI owned the text and submit had to read
  // it back out.
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const filled = current.length > 0 && next.length > 0 && confirm.length > 0;

  const change = useMutation({
    mutationFn: () =>
      api<TokenPair>('/me/password', {
        method: 'PUT',
        body: { current_password: current, new_password: next },
      }),
    onSuccess: async (tokens) => {
      if (session) {
        await signIn({
          serverUrl: session.serverUrl,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
        });
      }
      notify('success');
      router.back();
      Alert.alert(
        t`Password changed`,
        t`Your other devices will be signed out the next time they reconnect.`,
      );
    },
    onError: (err) => {
      notify('error');
      Alert.alert(t`Could not change password`, errorMessage(err));
    },
  });

  function submit() {
    if (next !== confirm) {
      Alert.alert(t`Could not change password`, t`The new passwords don't match.`);
      return;
    }
    if (next.length < MIN_LENGTH) {
      Alert.alert(t`Could not change password`, t`Use at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (next === current) {
      Alert.alert(t`Could not change password`, t`That is already your password.`);
      return;
    }
    change.mutate();
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <HeaderIconButton
              systemImage="checkmark"
              label={t`Save`}
              disabled={!filled || change.isPending}
              onPress={submit}
            />
          ),
        }}
      />
      <SettingsForm>
        <SettingsSection title={t`Current password`}>
          <View className="px-4 py-3">
            <PasswordInput
              value={current}
              onChangeText={setCurrent}
              placeholder={t`Current password`}
              textContentType="password"
              returnKeyType="next"
            />
          </View>
        </SettingsSection>

        <SettingsSection
          title={t`New password`}
          footer={t`At least ${MIN_LENGTH} characters. Changing it signs out your other devices — this one stays signed in.`}
        >
          <View className="px-4 py-3">
            <PasswordInput
              value={next}
              onChangeText={setNext}
              placeholder={t`New password`}
              textContentType="newPassword"
              returnKeyType="next"
            />
          </View>
          <View className="px-4 py-3">
            <PasswordInput
              value={confirm}
              onChangeText={setConfirm}
              placeholder={t`Confirm new password`}
              textContentType="newPassword"
              returnKeyType="go"
              onSubmitEditing={submit}
            />
          </View>
        </SettingsSection>

        {change.isPending ? (
          <SettingsSection>
            <Frame.Row>
              <Text size="sm" muted className="flex-1">
                {t`Saving…`}
              </Text>
            </Frame.Row>
          </SettingsSection>
        ) : null}
      </SettingsForm>
    </>
  );
}
