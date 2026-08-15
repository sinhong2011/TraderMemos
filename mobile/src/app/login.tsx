import { useForm } from '@tanstack/react-form';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Alert, Button, Card, Input } from 'panelui-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet as RNStyleSheet,
  TextInput,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';

import { Icon } from '@/components/icon';
import { ApiError, login, ping } from '@/api/client';
import { PasswordInput } from '@/components/password-input';
import { loadServerUrl, normalizeServerUrl, useSession } from '@/api/session';
import { t } from '@lingui/core/macro';
import { errorMessage } from '@/lib/errors';

const GRID_CELL = 44;

/** Self-hosting instructions — the answer to "I don't have a server yet". */
const DOCS_URL = 'https://trader-memos.vercel.app/en/docs';

/** Quiet hairline grid — the native translation of the web AuthShell's grid void. */
function AuthGridPattern() {
  const { width, height } = useWindowDimensions();
  const cols = Math.ceil(width / GRID_CELL);
  const rows = Math.ceil(height / GRID_CELL);

  return (
    <View style={RNStyleSheet.absoluteFill}>
      {Array.from({ length: cols }, (_, i) => (
        <View
          key={`v${i}`}
          className="absolute bottom-0 top-0 bg-border opacity-40"
          style={{ left: (i + 1) * GRID_CELL, width: RNStyleSheet.hairlineWidth }}
        />
      ))}
      {Array.from({ length: rows }, (_, i) => (
        <View
          key={`h${i}`}
          className="absolute left-0 right-0 bg-border opacity-40"
          style={{ top: (i + 1) * GRID_CELL, height: RNStyleSheet.hairlineWidth }}
        />
      ))}
    </View>
  );
}

/** Reachability of the typed host, shown beside the Server label. */
type Probe = { url: string; state: 'checking' | 'reachable' | 'unreachable' };

export default function LoginScreen() {
  const router = useRouter();
  const [primary] = useCSSVariable(['--color-primary']) as [string];
  // iPad (and landscape phones) get a centered column instead of an edge-to-edge
  // form — a 1024pt-wide input row reads as a broken layout, not a sign-in card.
  const { width: windowWidth } = useWindowDimensions();
  const wide = windowWidth >= 600;
  // `contentInsetAdjustmentBehavior` is UIKit-only, and this screen carries no
  // header to inset against. Android draws edge-to-edge, so without an explicit
  // pad the app icon renders at y=0 — behind the status bar, and on a Pixel
  // behind the camera cutout itself.
  const insets = useSafeAreaInsets();
  const { signIn } = useSession();
  const [error, setError] = useState<string | null>(null);

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
  const [probe, setProbe] = useState<Probe | null>(null);
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
    setProbe({ url, state: 'checking' });
    const reachable = await ping(url);
    if (seq !== probeSeq.current) return;
    setProbe({ url, state: reachable ? 'reachable' : 'unreachable' });
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
        // Probe /healthz first so a bad host reports "unreachable" rather than
        // surfacing as a confusing credentials failure. Re-run even when the
        // field's own check said reachable — that verdict can be minutes old.
        if (!(await ping(normalized))) {
          setProbe({ url: normalized, state: 'unreachable' });
          setError(t`Could not reach ${normalized}. Check the address, and that the server is running and reachable from this network.`);
          return;
        }
        setProbe({ url: normalized, state: 'reachable' });
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
        // The /healthz probe above only proves the host answered a moment ago;
        // a server that dies between the two requests used to put Expo's raw
        // "UnexpectedException" text in the alert card.
        setError(errorMessage(caught));
      }
    },
  });

  // Prefill the last host so a re-login after token expiry doesn't retype it,
  // and say straight away whether it still answers.
  useEffect(() => {
    void loadServerUrl().then((saved) => {
      if (saved) {
        form.setFieldValue('serverUrl', saved);
        void checkServer(saved);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View className="flex-1 bg-background">
      <View pointerEvents="none" style={RNStyleSheet.absoluteFill}>
        <AuthGridPattern />
        <View
          style={[
            RNStyleSheet.absoluteFill,
            {
              experimental_backgroundImage:
                'radial-gradient(circle at 50% 18%, rgba(4, 144, 200, 0.10) 0%, rgba(4, 144, 200, 0) 45%)',
            },
          ]}
        />
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerClassName={wide ? 'p-4 grow justify-center py-6' : 'p-4'}
          contentContainerStyle={
            Platform.OS === 'android'
              ? { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }
              : undefined
          }
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          {/* Fields track the reading measure, not the screen — an iPad-wide
              input row is unusable and reads as a layout bug. */}
          <View className="w-full max-w-[420px] self-center gap-4">
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
                      className="min-h-[52px] text-[17px]"
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
                      value={field.state.value}
                      onChangeText={field.handleChange}
                      placeholder={t`Enter your username`}
                      autoCapitalize="none"
                      autoCorrect={false}
                      textContentType="username"
                      returnKeyType="next"
                      onSubmitEditing={() => passwordRef.current?.focus()}
                      className="min-h-[52px] text-[17px]"
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
                    <Input
                      ref={totpRef}
                      value={field.state.value}
                      onChangeText={field.handleChange}
                      placeholder={t`6-digit code`}
                      keyboardType="number-pad"
                      // iOS fills this straight from the Passwords app.
                      textContentType="oneTimeCode"
                      autoComplete="one-time-code"
                      maxLength={6}
                      onSubmitEditing={() => void form.handleSubmit()}
                      returnKeyType="go"
                      className="min-h-[52px] text-[17px]"
                    />
                  )}
                </form.Field>
              </View>
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
                  size="lg"
                  fullWidth
                  loading={submitting}
                  onPress={() => void form.handleSubmit()}
                >
                  {t`Sign in`}
                </Button>
              )}
            </form.Subscribe>

            <Text className="pb-6 pt-2 text-center text-xs text-muted-foreground">{t`Self-hosted — your trade data stays on your stack.`}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/**
 * Verdict on the typed host. Absent until something has been typed, so the
 * label row stays quiet on a first, empty run.
 */
function ProbeChip({ probe }: { probe: Probe | null }) {
  const [mutedForeground, profit, destructive] = useCSSVariable([
    '--color-muted-foreground',
    '--color-profit',
    '--color-destructive',
  ]) as [string, string, string];
  if (!probe) return null;
  if (probe.state === 'checking') {
    return (
      <View className="flex-row items-center gap-1">
        <ActivityIndicator size="small" color={mutedForeground} />
        <Text className="text-[13px] text-muted-foreground">{t`Checking…`}</Text>
      </View>
    );
  }
  const reachable = probe.state === 'reachable';
  return (
    <View className="flex-row items-center gap-1">
      <Icon
        name={reachable ? 'checkmark.circle.fill' : 'exclamationmark.circle.fill'}
        size={13}
        tintColor={reachable ? profit : destructive}
      />
      <Text
        className={
          reachable ? 'text-[13px] font-semibold text-profit' : 'text-[13px] font-semibold text-destructive'
        }
      >
        {reachable ? t`Reachable` : t`No answer`}
      </Text>
    </View>
  );
}
