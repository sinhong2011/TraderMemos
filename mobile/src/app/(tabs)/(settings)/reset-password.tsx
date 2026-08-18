import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from 'panelui-native';
import { useRef, useState } from 'react';
import { Alert, type TextInput } from 'react-native';

import { useAdminUsers, useApiRequest, useMe } from '@/api/hooks';
import { CenteredButton } from '@/components/centered-button';
import { FormField, FormScreen } from '@/components/form-kit';
import { PasswordInput } from '@/components/password-input';
import { errorMessage } from '@/lib/errors';
import { notify } from '@/lib/haptics';
import { t } from '@lingui/core/macro';

/** Matches the server's `auth.MinPasswordLen`. */
const MIN_LENGTH = 10;

/**
 * An owner setting a new password for another user — the admin reset, which
 * by design needs no current password (the user has lost theirs; that is why
 * this exists). An entry form rather than the old one-line prompt: a security
 * action deserves a confirmation field and validation under the field it
 * belongs to, and the owner has to read the value back to whoever they are
 * resetting it for — the reveal toggle serves that.
 *
 * The user is read out of the list query rather than fetched — there is no
 * per-user GET, and coming here always means coming through user-detail.
 */
export default function ResetPasswordScreen() {
  const router = useRouter();
  const api = useApiRequest();
  const me = useMe();
  const { id } = useLocalSearchParams<{ id: string }>();

  const users = useAdminUsers(me.data?.is_admin ?? false);
  const user = (users.data ?? []).find((u) => u.id === id);

  const confirmField = useRef<TextInput>(null);
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [nextError, setNextError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const filled = next.length > 0 && confirm.length > 0;

  const reset = useMutation({
    mutationFn: () =>
      api<void>(`/admin/users/${id}/password`, {
        method: 'POST',
        body: { new_password: next },
      }),
    onSuccess: () => {
      notify('success');
      router.back();
      Alert.alert(
        t`Password reset`,
        t`${user?.email ?? ''} signs in with the new password. Their other devices are signed out.`,
      );
    },
    onError: (err) => {
      notify('error');
      Alert.alert(t`Could not reset password`, errorMessage(err));
    },
  });

  function submit() {
    if (next.length < MIN_LENGTH) {
      setNextError(t`Use at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (next !== confirm) {
      setConfirmError(t`The new passwords don't match.`);
      confirmField.current?.focus();
      return;
    }
    reset.mutate();
  }

  return (
    <FormScreen>
      <Text size="sm" muted>
        {t`Sets a new password for ${user?.email ?? ''} without their current one.`}
      </Text>

      <FormField label={t`New password`}>
        <PasswordInput
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
          errorMessage={confirmError ?? undefined}
          textContentType="newPassword"
          returnKeyType="go"
          accessibilityLabel={t`Confirm new password`}
          onSubmitEditing={submit}
        />
      </FormField>

      <CenteredButton
        role="destructive"
        label={reset.isPending ? t`Resetting…` : t`Reset password`}
        disabled={!filled}
        loading={reset.isPending}
        onPress={submit}
      />
      <Text size="xs" muted className="px-4">
        {t`A reset signs out that user's other devices.`}
      </Text>
    </FormScreen>
  );
}
