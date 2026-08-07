import { Button, Section, Text as UIText, TextField, useNativeState } from '@expo/ui/swift-ui';
import { font, foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useRef, useState } from 'react';
import { Alert, Linking } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import { queryKeys, useApiRequest, useMe } from '@/api/hooks';
import type { TotpSetup } from '@/api/types';
import { AppHost } from '@/components/app-host';
import { CenteredButton } from '@/components/centered-button';
import { SettingsForm } from '@/components/settings-form';
import { errorMessage } from '@/lib/errors';
import { notify } from '@/lib/haptics';
import { t } from '@lingui/core/macro';

/**
 * Two-factor enrolment and removal.
 *
 * No QR code: the phone rendering this screen is usually the phone holding the
 * authenticator, and you cannot scan your own display. The `otpauth://` link
 * hands the secret straight to iOS Passwords or any installed authenticator,
 * with the raw secret underneath for typing into a desktop app.
 */
export default function TwoFactorScreen() {
  const { theme } = useUnistyles();
  const queryClient = useQueryClient();
  const api = useApiRequest();
  const me = useMe();

  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const codeState = useNativeState('');
  const code = useRef('');
  const passwordState = useNativeState('');
  const password = useRef('');

  const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' as const });
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
        body: { secret: setup?.secret ?? '', code: code.current.trim() },
      }),
    onSuccess: () => {
      notify('success');
      setSetup(null);
      codeState.set('');
      code.current = '';
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
        body: { password: password.current, code: code.current.trim() },
      }),
    onSuccess: () => {
      notify('success');
      passwordState.set('');
      password.current = '';
      codeState.set('');
      code.current = '';
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
      <AppHost style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <SettingsForm>
          <Section
            footer={
              <UIText>
                {t`Turning it off needs your password and a current code, so a borrowed unlocked phone can't remove it.`}
              </UIText>
            }
            title={t`Turn off two-factor`}
          >
            <TextField
              placeholder={t`Password`}
              text={passwordState}
              onTextChange={(text) => {
                password.current = text;
              }}
            />
            <TextField
              placeholder={t`6-digit code`}
              text={codeState}
              onTextChange={(text) => {
                code.current = text;
              }}
            />
            <CenteredButton
              label={disable.isPending ? t`Turning off…` : t`Turn off two-factor`}
              role="destructive"
              disabled={disable.isPending}
              onPress={() => disable.mutate()}
            />
          </Section>

          {/* The break-glass, stated where someone locked out would look for
              it — there is no recovery-code list by design. */}
          <Section title={t`If you lose your authenticator`}>
            <UIText modifiers={[font({ size: 13 }), secondary]}>
              {t`Run "tradermemos disable-totp --email ${me.data?.email ?? ''}" on the server. There are no recovery codes to lose.`}
            </UIText>
          </Section>
        </SettingsForm>
      </AppHost>
    );
  }

  // ---- Not enrolled: start, then confirm ----------------------------------
  return (
    <AppHost style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <SettingsForm>
        {setup == null ? (
          <Section
            footer={
              <UIText>
                {t`Adds a 6-digit code from an authenticator app to your password at sign-in.`}
              </UIText>
            }
          >
            <CenteredButton
              label={start.isPending ? t`Preparing…` : t`Set up two-factor`}
              disabled={start.isPending}
              onPress={() => start.mutate()}
            />
          </Section>
        ) : (
          <>
            <Section
              title={t`1. Add to your authenticator`}
              footer={
                <UIText>
                  {t`Opens iOS Passwords or whichever authenticator you use. Nothing is saved until you enter a code below.`}
                </UIText>
              }
            >
              <Button
                systemImage="key.horizontal.fill"
                label={t`Add to authenticator`}
                onPress={() => void Linking.openURL(setup.otpauth_url)}
              />
              <Button
                systemImage="doc.on.doc"
                label={t`Copy setup key`}
                onPress={() => {
                  void Clipboard.setStringAsync(setup.secret);
                  notify('success');
                }}
              />
              <UIText modifiers={[font({ size: 13 }), secondary]}>{setup.secret}</UIText>
            </Section>

            <Section
              title={t`2. Enter a code to confirm`}
              footer={
                <UIText>{t`This proves the authenticator was added before it's required.`}</UIText>
              }
            >
              <TextField
                placeholder={t`6-digit code`}
                text={codeState}
                onTextChange={(text) => {
                  code.current = text;
                }}
              />
              <CenteredButton
                label={confirm.isPending ? t`Confirming…` : t`Turn on two-factor`}
                disabled={confirm.isPending}
                onPress={() => confirm.mutate()}
              />
              <CenteredButton label={t`Cancel`} onPress={() => setSetup(null)} />
            </Section>
          </>
        )}
      </SettingsForm>
    </AppHost>
  );
}
