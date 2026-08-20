import { useForm } from '@tanstack/react-form';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Button, Card, Input } from 'panelui-native';
import { useEffect, useRef, useState } from 'react';
import { TextInput, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { ApiError, completeSetup } from '@/api/client';
import { loadServerUrl, normalizeServerUrl, saveServerUrl, useSession } from '@/api/session';
import { AuthScreen, ProbeChip } from '@/components/auth-chrome';
import { FormField, FormPicker } from '@/components/form-kit';
import { Icon } from '@/components/icon';
import { PasswordInput } from '@/components/password-input';
import { t } from '@lingui/core/macro';
import { numericText, parseAmount } from '@/lib/amount';
import { errorMessage } from '@/lib/errors';
import { DISPLAY_CURRENCIES } from '@/lib/prefs';
import {
  DEFAULT_MIN_PASSWORD_LENGTH,
  probeServer,
  type ServerProbe,
} from '@/lib/server-probe';

function bounceToSignIn(router: ReturnType<typeof useRouter>, serverUrl: string) {
  router.replace({
    pathname: '/login',
    params: { notice: 'setup_complete', serverUrl },
  });
}

export default function SetupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ serverUrl?: string }>();
  const { signIn } = useSession();
  const [primary] = useCSSVariable(['--color-primary']) as [string];

  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const accountRef = useRef<TextInput>(null);

  const [error, setError] = useState<string | null>(null);
  const [probe, setProbe] = useState<ServerProbe | null>(null);
  const probeSeq = useRef(0);
  const minPasswordLength = probe?.minPasswordLength ?? DEFAULT_MIN_PASSWORD_LENGTH;

  async function checkServer(raw: string) {
    const url = normalizeServerUrl(raw);
    if (!url) {
      setProbe(null);
      return null;
    }
    const seq = ++probeSeq.current;
    setProbe({ url, state: 'checking', minPasswordLength });
    // Status-endpoint failures stay on this screen: degrading to reachable
    // would bounce a first-user to Sign in, which is the bug this flow exists
    // to close.
    const verdict = await probeServer(url, 'needs_setup');
    if (seq !== probeSeq.current) return null;
    const next = { url, ...verdict };
    setProbe(next);
    return next;
  }

  const form = useForm({
    defaultValues: {
      serverUrl: '',
      username: '',
      password: '',
      confirm: '',
      accountName: 'Main',
      currency: 'USD',
      balance: '',
    },
    onSubmit: async ({ value }) => {
      const normalized = normalizeServerUrl(value.serverUrl);
      if (!normalized) {
        setError(t`Enter your TraderMemos server address`);
        return;
      }
      if (!value.username.trim()) {
        setError(t`Enter a username`);
        return;
      }
      if (value.password.length < minPasswordLength) {
        setError(t`Password must be at least ${minPasswordLength} characters.`);
        return;
      }
      if (value.password !== value.confirm) {
        setError(t`Passwords do not match.`);
        return;
      }
      const starting = parseAmount(value.balance);
      if (starting === undefined) {
        setError(t`Enter a valid starting balance, or leave it blank.`);
        return;
      }
      setError(null);
      try {
        const verdict = await probeServer(normalized, 'needs_setup');
        setProbe({ url: normalized, ...verdict });
        if (verdict.state === 'unreachable') {
          setError(
            t`Could not reach ${normalized}. Check the address, and that the server is running and reachable from this network.`,
          );
          return;
        }
        if (verdict.state === 'reachable') {
          await saveServerUrl(normalized);
          bounceToSignIn(router, normalized);
          return;
        }
        const result = await completeSetup(normalized, {
          email: value.username.trim(),
          password: value.password,
          account: {
            name: value.accountName.trim() || 'Main',
            broker: '',
            account_type: 'cash',
            base_currency: value.currency.trim() || 'USD',
            starting_balance: starting ?? 0,
          },
        });
        await signIn({
          serverUrl: normalized,
          accessToken: result.access_token,
          refreshToken: result.refresh_token,
        });
        router.replace('/');
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 409) {
          await saveServerUrl(normalized);
          bounceToSignIn(router, normalized);
          return;
        }
        setError(errorMessage(caught));
      }
    },
  });

  // Prefill from the login probe (or the last saved host), then confirm the
  // host still needs setup. An owner that appeared in the meantime — or a
  // deep link onto this route against a finished install — must not strand.
  useEffect(() => {
    const fromParams = typeof params.serverUrl === 'string' ? params.serverUrl : '';
    void (async () => {
      const saved = fromParams || (await loadServerUrl());
      if (!saved) return;
      form.setFieldValue('serverUrl', saved);
      const verdict = await checkServer(saved);
      if (verdict?.state === 'reachable') {
        bounceToSignIn(router, verdict.url);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthScreen>
      <View className="items-center gap-2 pt-6">
        <Image
          source={require('../../assets/images/icon.png')}
          style={{ width: 56, height: 56, borderRadius: 12.5 }}
          accessibilityIgnoresInvertColors
        />
        <Text className="text-base font-semibold text-foreground">TraderMemos</Text>
      </View>

      <View className="gap-1 pt-2">
        <Text className="text-[28px] font-bold text-foreground">{t`Set up`}</Text>
        <Text className="text-[15px] text-muted-foreground">
          {t`Create the first account on this server. It becomes the owner.`}
        </Text>
      </View>

      <Card>
        <Card.Content className="flex-row gap-3 p-4">
          <View className="h-[34px] w-[34px] items-center justify-center rounded-md bg-fill">
            <Icon name="person.crop.circle" size={17} tintColor={primary} />
          </View>
          <View className="flex-1 gap-1">
            <Text className="text-[15px] font-semibold text-foreground">{t`This server has no owner yet`}</Text>
            <Text className="text-[13px] leading-[18px] text-muted-foreground">
              {t`The first account you create here is the admin of this TraderMemos server. You can import trades later from Settings.`}
            </Text>
          </View>
        </Card.Content>
      </Card>

      <View className="gap-4">
        <View className="gap-2">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-semibold text-foreground">{t`Server address`}</Text>
            <ProbeChip probe={probe} />
          </View>
          <form.Field name="serverUrl">
            {(field) => (
              <Input
                variant="filled"
                value={field.state.value}
                onChangeText={field.handleChange}
                onBlur={() => {
                  void (async () => {
                    const verdict = await checkServer(field.state.value);
                    if (verdict?.state === 'reachable') {
                      await saveServerUrl(verdict.url);
                      bounceToSignIn(router, verdict.url);
                    }
                  })();
                }}
                placeholder="https://trades.example.com"
                description={t`Origin only — the app adds /api/v1 itself.`}
                keyboardType="url"
                textContentType="URL"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                className="min-h-[52px] rounded-3xl border-0 text-[17px]"
              />
            )}
          </form.Field>
        </View>

        <View className="gap-2">
          <Text className="text-base font-semibold text-foreground">{t`Username`}</Text>
          <form.Field name="username">
            {(field) => (
              <Input
                variant="filled"
                value={field.state.value}
                onChangeText={field.handleChange}
                placeholder={t`Enter a username`}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="username"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                className="min-h-[52px] rounded-3xl border-0 text-[17px]"
              />
            )}
          </form.Field>
        </View>

        <View className="gap-2">
          <Text className="text-base font-semibold text-foreground">{t`Password`}</Text>
          <form.Field
            name="password"
            validators={{
              onChange: ({ value }) =>
                value.length > 0 && value.length < minPasswordLength
                  ? t`Password must be at least ${minPasswordLength} characters.`
                  : undefined,
            }}
          >
            {(field) => (
              <PasswordInput
                ref={passwordRef}
                value={field.state.value}
                onChangeText={field.handleChange}
                placeholder={t`Enter a password`}
                description={t`Minimum ${minPasswordLength} characters.`}
                errorMessage={
                  typeof field.state.meta.errors[0] === 'string'
                    ? field.state.meta.errors[0]
                    : undefined
                }
                textContentType="newPassword"
                returnKeyType="next"
                onSubmitEditing={() => confirmRef.current?.focus()}
              />
            )}
          </form.Field>
        </View>

        <View className="gap-2">
          <Text className="text-base font-semibold text-foreground">{t`Confirm password`}</Text>
          <form.Field
            name="confirm"
            validators={{
              onChangeListenTo: ['password'],
              onChange: ({ value, fieldApi }) =>
                value.length > 0 && value !== fieldApi.form.getFieldValue('password')
                  ? t`Passwords do not match.`
                  : undefined,
            }}
          >
            {(field) => (
              <PasswordInput
                ref={confirmRef}
                value={field.state.value}
                onChangeText={field.handleChange}
                placeholder={t`Repeat password`}
                errorMessage={
                  typeof field.state.meta.errors[0] === 'string'
                    ? field.state.meta.errors[0]
                    : undefined
                }
                textContentType="newPassword"
                returnKeyType="next"
                onSubmitEditing={() => accountRef.current?.focus()}
              />
            )}
          </form.Field>
        </View>

        <View className="gap-2">
          <Text className="text-base font-semibold text-foreground">{t`Trading account`}</Text>
          <form.Field name="accountName">
            {(field) => (
              <Input
                ref={accountRef}
                variant="filled"
                value={field.state.value}
                onChangeText={field.handleChange}
                placeholder="Main"
                description={t`Created for your journal. You can change this later in Settings.`}
                autoCorrect={false}
                returnKeyType="next"
                className="min-h-[52px] rounded-3xl border-0 text-[17px]"
              />
            )}
          </form.Field>
        </View>

        <FormField label={t`Currency`}>
          <form.Field name="currency">
            {(field) => (
              <FormPicker
                label={t`Currency`}
                selectedValue={field.state.value}
                onValueChange={field.handleChange}
                items={DISPLAY_CURRENCIES.map((code) => ({ value: code, label: code }))}
              />
            )}
          </form.Field>
        </FormField>

        <View className="gap-2">
          <Text className="text-base font-semibold text-foreground">{t`Starting balance`}</Text>
          <form.Field name="balance">
            {(field) => (
              <Input
                variant="filled"
                value={field.state.value}
                onChangeText={(text) => field.handleChange(numericText(text))}
                placeholder="0"
                description={t`Recorded as the first deposit. Leave blank to start at zero.`}
                keyboardType="decimal-pad"
                returnKeyType="done"
                onSubmitEditing={() => void form.handleSubmit()}
                className="min-h-[52px] rounded-3xl border-0 text-[17px]"
              />
            )}
          </form.Field>
        </View>
      </View>

      {error ? (
        <Alert variant="destructive">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description selectable>{error}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(submitting) => (
          <Button
            size="md"
            className="rounded-3xl"
            fullWidth
            loading={submitting}
            onPress={() => void form.handleSubmit()}
          >
            {t`Create owner account`}
          </Button>
        )}
      </form.Subscribe>

      <Text className="pb-6 pt-2 text-center text-xs text-muted-foreground">{t`Self-hosted — your trade data stays on your stack.`}</Text>
    </AuthScreen>
  );
}
