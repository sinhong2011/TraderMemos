import { SecureField, Section, Text as UIText, useNativeState } from '@expo/ui/swift-ui';
import { foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import { useApiRequest } from '@/api/hooks';
import { useSession } from '@/api/session';
import type { TokenPair } from '@/api/types';
import { AppHost } from '@/components/app-host';
import { HeaderIconButton } from '@/components/header-icon-button';
import { SettingsForm } from '@/components/settings-form';
import { notify } from '@/lib/haptics';
import { t } from '@lingui/core/macro';

/** Matches the server's `auth.MinPasswordLen`. */
const MIN_LENGTH = 10;

/**
 * Change your own password.
 *
 * Three native SecureFields rather than a prompt — `Alert.prompt` takes one
 * value, and a confirmation field is the cheapest guard against locking
 * yourself out of a self-hosted server by typo.
 *
 * The server answers with a fresh token pair, because the change invalidates
 * every token minted against the old password including the one this request
 * arrived with. Persisting it is what keeps *this* device signed in while the
 * others drop.
 */
export default function ChangePasswordScreen() {
  const router = useRouter();
  const { theme } = useUnistyles();
  const { session, signIn } = useSession();
  const api = useApiRequest();

  // SwiftUI owns the field text; refs mirror it for submit-time reads, the
  // same binding pattern the account form and AI screens use.
  const currentState = useNativeState('');
  const current = useRef('');
  const nextState = useNativeState('');
  const next = useRef('');
  const confirmState = useNativeState('');
  const confirm = useRef('');
  // Only the submit-enabled question needs to re-render on a keystroke.
  const [filled, setFilled] = useState(false);

  function refresh() {
    setFilled(
      current.current.length > 0 && next.current.length > 0 && confirm.current.length > 0,
    );
  }

  const change = useMutation({
    mutationFn: () =>
      api<TokenPair>('/me/password', {
        method: 'PUT',
        body: { current_password: current.current, new_password: next.current },
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
      Alert.alert(t`Could not change password`, err.message);
    },
  });

  function submit() {
    if (next.current !== confirm.current) {
      Alert.alert(t`Could not change password`, t`The new passwords don't match.`);
      return;
    }
    if (next.current.length < MIN_LENGTH) {
      Alert.alert(
        t`Could not change password`,
        t`Use at least ${MIN_LENGTH} characters.`,
      );
      return;
    }
    if (next.current === current.current) {
      Alert.alert(t`Could not change password`, t`That is already your password.`);
      return;
    }
    change.mutate();
  }

  return (
    <AppHost style={{ flex: 1, backgroundColor: theme.colors.background }}>
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
        <Section title={t`Current password`}>
          <SecureField
            placeholder={t`Current password`}
            text={currentState}
            onTextChange={(text) => {
              current.current = text;
              refresh();
            }}
          />
        </Section>

        <Section
          title={t`New password`}
          footer={
            <UIText>
              {t`At least ${MIN_LENGTH} characters. Changing it signs out your other devices — this one stays signed in.`}
            </UIText>
          }
        >
          <SecureField
            placeholder={t`New password`}
            text={nextState}
            onTextChange={(text) => {
              next.current = text;
              refresh();
            }}
          />
          <SecureField
            placeholder={t`Confirm new password`}
            text={confirmState}
            onTextChange={(text) => {
              confirm.current = text;
              refresh();
            }}
          />
        </Section>

        {change.isPending ? (
          <Section>
            <UIText modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
              {t`Saving…`}
            </UIText>
          </Section>
        ) : null}
      </SettingsForm>
    </AppHost>
  );
}
