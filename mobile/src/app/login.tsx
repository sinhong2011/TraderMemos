import { useForm } from '@tanstack/react-form';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Button, Card, Input, OtpInput } from 'panelui-native';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, TextInput, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { Icon } from '@/components/icon';
import { ApiError, login } from '@/api/client';
import { PasswordInput } from '@/components/password-input';
import { AuthScreen, ProbeChip } from '@/components/auth-chrome';
import { loadServerUrl, normalizeServerUrl, saveServerUrl, useSession } from '@/api/session';
import { t } from '@lingui/core/macro';
import { errorMessage } from '@/lib/errors';
import { probeServer, type ServerProbe } from '@/lib/server-probe';

/** Self-hosting instructions — the answer to "I don't have a server yet". */
const DOCS_URL = 'https://trader-memos.vercel.app/en/docs';

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ notice?: string; serverUrl?: string }>();
  const [primary] = useCSSVariable(['--color-primary']) as [string];
  const { signIn } = useSession();
  const [error, setError] = useState<string | null>(null);
  const notice =
    params.notice === 'setup_complete'
      ? t`This server already has an owner. Sign in with that account.`
      : null;

  const usernameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const totpRef = useRef<TextInput>(null);
  // Set once the server answers `totp_required`: the password was right, the
  // account just has a second factor. Revealing the field only at that point
  // keeps the first screen to two credentials for the accounts that don't.
  const [needsTotp, setNeedsTotp] = useState(false);

  // The host is the one field here nobody can validate from memory — it is an
  // address, typed by hand, often on a LAN. Probing it as soon as the field is
  // left turns "wrong password?" guesswork into an answer before the first
  // sign-in attempt. Informational only: submit re-checks (see below).
  const [probe, setProbe] = useState<ServerProbe | null>(null);
  const probeSeq = useRef(0);

  async function checkServer(raw: string) {
    const url = normalizeServerUrl(raw);
    if (!url) {
      setProbe(null);
      return;
    }
    // Each probe carries a sequence number so a slow answer for an old host
    // can't overwrite the verdict for the one now in the field.
    const seq = ++probeSeq.current;
    setProbe({ url, state: 'checking', minPasswordLength: probe?.minPasswordLength ?? 10 });
    const verdict = await probeServer(url);
    if (seq !== probeSeq.current) return;
    setProbe({ url, ...verdict });
  }

  // TanStack Form, same stack as web — the reference pattern for upcoming
  // forms (new trade, settings, notes). Server-side failures stay in local
  // state since they come from the API, not field validation.
  const form = useForm({
    defaultValues: { serverUrl: '', username: '', password: '', totpCode: '' },
    onSubmit: async ({ value }) => {
      // The CTA stays enabled and validates on tap — feedback beats a dead button.
      const normalized = normalizeServerUrl(value.serverUrl);
      if (!normalized) {
        setError(t`Enter your TraderMemos server address`);
        return;
      }
      if (!value.username.trim() || !value.password) {
        setError(t`Enter your username and password`);
        return;
      }
      setError(null);
      try {
        // Probe /healthz (and setup status) first so a bad host reports
        // "unreachable" rather than surfacing as a confusing credentials
        // failure. Re-run even when the field's own check said reachable —
        // that verdict can be minutes old.
        const verdict = await probeServer(normalized);
        setProbe({ url: normalized, ...verdict });
        if (verdict.state === 'unreachable') {
          setError(
            t`Could not reach ${normalized}. Check the address, and that the server is running and reachable from this network.`,
          );
          return;
        }
        if (verdict.state === 'needs_setup') {
          await saveServerUrl(normalized);
          router.replace({ pathname: '/setup', params: { serverUrl: normalized } });
          return;
        }
        const tokens = await login(normalized, {
          email: value.username.trim(),
          password: value.password,
          ...(value.totpCode.trim() ? { totp_code: value.totpCode.trim() } : {}),
        });
        await signIn({
          serverUrl: normalized,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
        });
        router.replace('/');
      } catch (caught) {
        // `totp_required` is not a failure to report as one — the password was
        // accepted and the server is asking for the second factor.
        if (caught instanceof ApiError && caught.code === 'totp_required') {
          setNeedsTotp(true);
          setError(null);
          // The field mounts on this render; focus lands on the next tick.
          setTimeout(() => totpRef.current?.focus(), 0);
          return;
        }
        if (caught instanceof ApiError && caught.code === 'totp_invalid') {
          setNeedsTotp(true);
          setError(t`That code is not valid. Codes change every 30 seconds.`);
          return;
        }
        if (caught instanceof ApiError && caught.status === 401) {
          setError(t`Username or password is incorrect.`);
          return;
        }
        // The /healthz probe above only proves the host answered a moment ago;
        // a server that dies between the two requests used to put Expo's raw
        // "UnexpectedException" text in the alert card.
        setError(errorMessage(caught));
      }
    },
  });

  // A zero-user host is not a sign-in screen. Once the probe says so, leave
  // — the session gate still points here because the server URL is unknown
  // until the user types it; Setup is the next step, not a competing entry.
  useEffect(() => {
    if (probe?.state !== 'needs_setup') return;
    void saveServerUrl(probe.url);
    router.replace({ pathname: '/setup', params: { serverUrl: probe.url } });
  }, [probe, router]);

  // Prefill the last host so a re-login after token expiry doesn't retype it,
  // and say straight away whether it still answers. Params win when Setup
  // bounced us back (owner already exists).
  useEffect(() => {
    const fromParams = typeof params.serverUrl === 'string' ? params.serverUrl : '';
    void (async () => {
      const saved = fromParams || (await loadServerUrl());
      if (saved) {
        form.setFieldValue('serverUrl', saved);
        void checkServer(saved);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthScreen>
      <View className="items-center gap-2 pt-6">
        <Image
          source={require('../../assets/images/icon.png')}
          // iOS icon corner ratio (~22.4%) so the mark reads as an app
          // icon, not a photo.
          style={{ width: 56, height: 56, borderRadius: 12.5 }}
          accessibilityIgnoresInvertColors
        />
        <Text className="text-base font-semibold text-foreground">TraderMemos</Text>
      </View>

      {/* Title block stays left-aligned with the form column. */}
      <View className="gap-1 pt-2">
        <Text className="text-[28px] font-bold text-foreground">{t`Sign in`}</Text>
        <Text className="text-[15px] text-muted-foreground">{t`Connect to your TraderMemos server.`}</Text>
      </View>

      {/* There is no TraderMemos cloud to sign up for, and nothing below
          makes sense until that is said. First-run reads this before it
          reaches a field it cannot fill. Explainer, not an alert: card
          surface with a brand-tinted glyph well, no warning color. */}
      <Card>
        <Card.Content className="flex-row gap-3 p-4">
          <View className="h-[34px] w-[34px] items-center justify-center rounded-md bg-fill">
            <Icon name="externaldrive.badge.wifi" size={17} tintColor={primary} />
          </View>
          <View className="flex-1 gap-1">
            <Text className="text-[15px] font-semibold text-foreground">{t`You bring the server`}</Text>
            <Text className="text-[13px] leading-[18px] text-muted-foreground">
              {t`TraderMemos is self-hosted: this app is the client for a server you run, and every screen in it comes from that server.`}
            </Text>
            <Pressable
              onPress={() => void Linking.openURL(DOCS_URL)}
              accessibilityRole="link"
              className="flex-row items-center gap-1 pt-1 active:opacity-60"
            >
              <Text className="text-[13px] font-semibold text-primary">{t`How to set one up`}</Text>
              <Icon name="arrow.up.forward" size={11} tintColor={primary} />
            </Pressable>
          </View>
        </Card.Content>
      </Card>

      <View className="gap-4">
        <View className="gap-2">
          {/* The label and its verdict share a baseline — the status
              belongs to the field, not the page, so it never becomes
              another banner. */}
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
                onBlur={() => void checkServer(field.state.value)}
                placeholder="https://trades.example.com"
                description={t`Origin only — the app adds /api/v1 itself.`}
                keyboardType="url"
                textContentType="URL"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => {
                  void checkServer(field.state.value);
                  usernameRef.current?.focus();
                }}
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
                ref={usernameRef}
                variant="filled"
                value={field.state.value}
                onChangeText={field.handleChange}
                placeholder={t`Enter your username`}
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
          <form.Field name="password">
            {(field) => (
              <PasswordInput
                ref={passwordRef}
                value={field.state.value}
                onChangeText={field.handleChange}
                placeholder={t`Enter your password`}
                onSubmitEditing={() => void form.handleSubmit()}
                returnKeyType="go"
              />
            )}
          </form.Field>
        </View>
      </View>

      {needsTotp ? (
        <View className="gap-2">
          <Text className="text-base font-semibold text-foreground">{t`Authenticator code`}</Text>
          <form.Field name="totpCode">
            {(field) => (
              // One cell per digit; the hidden field carries the
              // one-time-code autofill, so iOS still fills it straight
              // from the Passwords app.
              <OtpInput
                ref={totpRef}
                className="items-center"
                value={field.state.value}
                onChangeText={field.handleChange}
                onComplete={() => void form.handleSubmit()}
                accessibilityLabel={t`Authenticator code`}
              />
            )}
          </form.Field>
        </View>
      ) : null}

      {notice ? (
        <Alert>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description selectable>{notice}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

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
            {t`Sign in`}
          </Button>
        )}
      </form.Subscribe>

      <Text className="pb-6 pt-2 text-center text-xs text-muted-foreground">{t`Self-hosted — your trade data stays on your stack.`}</Text>
    </AuthScreen>
  );
}
