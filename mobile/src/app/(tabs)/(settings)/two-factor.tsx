import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { Frame, Input, Text } from 'panelui-native';
import { useState } from 'react';
import { Alert, Linking, View } from 'react-native';

import { queryKeys, useApiRequest, useMe } from '@/api/hooks';
import type { TotpSetup } from '@/api/types';
import { CenteredButton } from '@/components/centered-button';
import { PasswordInput } from '@/components/password-input';
import { SettingsForm } from '@/components/settings-form';
import { SettingsButton, SettingsSection } from '@/components/settings-rows';
import { errorMessage } from '@/lib/errors';
import { notify } from '@/lib/haptics';
import { t } from '@lingui/core/macro';

/**
 * Two-factor enrolment and removal.
 *
 * No QR code: the phone rendering this screen is usually the phone holding the
 * authenticator, and you cannot scan your own display. The `otpauth://` link
 * hands the secret straight to the platform password manager or any installed
 * authenticator, with the raw secret underneath for typing into a desktop app.
 */
export default function TwoFactorScreen() {
  const queryClient = useQueryClient();
  const api = useApiRequest();
  const me = useMe();

  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');

  const enabled = me.data?.totp_enabled ?? false;

  function refreshMe() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.me() });
  }

  const start = useMutation({
    mutationFn: () => api<TotpSetup>('/me/totp/start', { method: 'POST' }),
    onSuccess: setSetup,
    onError: (err) => Alert.alert(t`Could not start setup`, errorMessage(err)),
  });

  const confirm = useMutation({
    mutationFn: () =>
      api<void>('/me/totp/confirm', {
        method: 'POST',
        body: { secret: setup?.secret ?? '', code: code.trim() },
      }),
    onSuccess: () => {
      notify('success');
      setSetup(null);
      setCode('');
      refreshMe();
      Alert.alert(
        t`Two-factor is on`,
        t`You'll need a code from your authenticator the next time you sign in.`,
      );
    },
    onError: (err) => {
      notify('error');
      Alert.alert(t`Could not enable`, errorMessage(err));
    },
  });

  const disable = useMutation({
    mutationFn: () =>
      api<void>('/me/totp/disable', {
        method: 'POST',
        body: { password, code: code.trim() },
      }),
    onSuccess: () => {
      notify('success');
      setPassword('');
      setCode('');
      refreshMe();
      Alert.alert(t`Two-factor is off`, t`Your password alone signs you in again.`);
    },
    onError: (err) => {
      notify('error');
      Alert.alert(t`Could not turn off`, errorMessage(err));
    },
  });

  // ---- Enrolled: offer removal -------------------------------------------
  if (enabled) {
    return (
      <SettingsForm>
        <SettingsSection
          title={t`Turn off two-factor`}
          footer={t`Turning it off needs your password and a current code, so a borrowed unlocked phone can't remove it.`}
        >
          <View className="px-4 py-3">
            <PasswordInput
              value={password}
              onChangeText={setPassword}
              placeholder={t`Password`}
            />
          </View>
          <View className="px-4 py-3">
            <CodeField value={code} onChangeText={setCode} />
          </View>
        </SettingsSection>

        <CenteredButton
          label={disable.isPending ? t`Turning off…` : t`Turn off two-factor`}
          role="destructive"
          loading={disable.isPending}
          onPress={() => disable.mutate()}
        />

        {/* The break-glass, stated where someone locked out would look for
            it — there is no recovery-code list by design. */}
        <SettingsSection title={t`If you lose your authenticator`}>
          <Frame.Row>
            <Text size="sm" muted className="flex-1">
              {t`Run "tradermemos disable-totp --email ${me.data?.email ?? ''}" on the server. There are no recovery codes to lose.`}
            </Text>
          </Frame.Row>
        </SettingsSection>
      </SettingsForm>
    );
  }

  // ---- Not enrolled: start, then confirm ----------------------------------
  return (
    <SettingsForm>
      {setup == null ? (
        <View className="gap-2">
          <CenteredButton
            label={start.isPending ? t`Preparing…` : t`Set up two-factor`}
            loading={start.isPending}
            onPress={() => start.mutate()}
          />
          <Text size="xs" muted className="px-4">
            {t`Adds a 6-digit code from an authenticator app to your password at sign-in.`}
          </Text>
        </View>
      ) : (
        <>
          <SettingsSection
            title={t`1. Add to your authenticator`}
            footer={t`Opens your password manager or whichever authenticator you use. Nothing is saved until you enter a code below.`}
          >
            <SettingsButton
              systemImage="key.horizontal.fill"
              label={t`Add to authenticator`}
              onPress={() => void Linking.openURL(setup.otpauth_url)}
            />
            <SettingsButton
              systemImage="doc.on.doc"
              label={t`Copy setup key`}
              onPress={() => {
                void Clipboard.setStringAsync(setup.secret);
                notify('success');
              }}
            />
            <Frame.Row>
              {/* Selectable: this is the string that gets typed into a desktop
                  authenticator when the link cannot reach one. */}
              <Text size="sm" muted selectable className="flex-1">
                {setup.secret}
              </Text>
            </Frame.Row>
          </SettingsSection>

          <SettingsSection
            title={t`2. Enter a code to confirm`}
            footer={t`This proves the authenticator was added before it's required.`}
          >
            <View className="px-4 py-3">
              <CodeField value={code} onChangeText={setCode} />
            </View>
          </SettingsSection>

          <View className="gap-2">
            <CenteredButton
              label={confirm.isPending ? t`Confirming…` : t`Turn on two-factor`}
              loading={confirm.isPending}
              onPress={() => confirm.mutate()}
            />
            <CenteredButton label={t`Cancel`} onPress={() => setSetup(null)} />
          </View>
        </>
      )}
    </SettingsForm>
  );
}

/** The 6-digit field, wired for the one-time-code autofill both platforms do. */
function CodeField({
  value,
  onChangeText,
}: {
  value: string;
  onChangeText: (next: string) => void;
}) {
  return (
    <Input
      value={value}
      onChangeText={onChangeText}
      placeholder={t`6-digit code`}
      keyboardType="number-pad"
      textContentType="oneTimeCode"
      autoComplete="one-time-code"
      maxLength={6}
      accessibilityLabel={t`6-digit code`}
    />
  );
}
