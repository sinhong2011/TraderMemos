import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useRef, useState } from 'react';
import { Alert, type TextInput } from 'react-native';

import { useApiRequest } from '@/api/hooks';
import { useSession } from '@/api/session';
import type { TokenPair } from '@/api/types';
import { FormField, FormScreen } from '@/components/form-kit';
import { HeaderIconButton } from '@/components/header-icon-button';
import { PasswordInput } from '@/components/password-input';
import { errorMessage } from '@/lib/errors';
import { notify } from '@/lib/haptics';
import { t } from '@lingui/core/macro';

/** Matches the server's `auth.MinPasswordLen`. */
const MIN_LENGTH = 10;

/**
 * Change your own password. An entry form (the form kit), three masked fields
 * rather than a prompt — `Alert.prompt` takes one value, and a confirmation
 * field is the cheapest guard against locking yourself out of a self-hosted
 * server by typo. Each one is the app's `PasswordInput`, so the reveal toggle
 * is there when a typo is the likelier explanation than a wrong password.
 * Validation lands under the field it belongs to, not in an alert.
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
  const nextField = useRef<TextInput>(null);
  const confirmField = useRef<TextInput>(null);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [nextError, setNextError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
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
    if (next.length < MIN_LENGTH) {
      setNextError(t`Use at least ${MIN_LENGTH} characters.`);
      nextField.current?.focus();
      return;
    }
    if (next === current) {
      setNextError(t`That is already your password.`);
      nextField.current?.focus();
      return;
    }
    if (next !== confirm) {
      setConfirmError(t`The new passwords don't match.`);
      confirmField.current?.focus();
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
              label={change.isPending ? t`Saving…` : t`Save`}
              disabled={!filled || change.isPending}
              onPress={submit}
            />
          ),
        }}
      />
      <FormScreen>
        <FormField label={t`Current password`}>
          <PasswordInput
            value={current}
            onChangeText={setCurrent}
            textContentType="password"
            returnKeyType="next"
            accessibilityLabel={t`Current password`}
            onSubmitEditing={() => nextField.current?.focus()}
          />
        </FormField>

        <FormField label={t`New password`}>
          <PasswordInput
            ref={nextField}
            value={next}
            onChangeText={(text) => {
              setNext(text);
              if (nextError) setNextError(null);
            }}
            placeholder={t`At least ${MIN_LENGTH} characters`}
            errorMessage={nextError ?? undefined}
            textContentType="newPassword"
            returnKeyType="next"
            accessibilityLabel={t`New password`}
            onSubmitEditing={() => confirmField.current?.focus()}
          />
        </FormField>

        <FormField label={t`Confirm new password`}>
          <PasswordInput
            ref={confirmField}
            value={confirm}
            onChangeText={(text) => {
              setConfirm(text);
              if (confirmError) setConfirmError(null);
            }}
            description={t`Changing it signs out your other devices — this one stays signed in.`}
            errorMessage={confirmError ?? undefined}
            textContentType="newPassword"
            returnKeyType="go"
            accessibilityLabel={t`Confirm new password`}
            onSubmitEditing={submit}
          />
        </FormField>
      </FormScreen>
    </>
  );
}
