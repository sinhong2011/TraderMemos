import { useForm } from '@tanstack/react-form';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet as RNStyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

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
        <View key={`v${i}`} style={[styles.gridLineV, { left: (i + 1) * GRID_CELL }]} />
      ))}
      {Array.from({ length: rows }, (_, i) => (
        <View key={`h${i}`} style={[styles.gridLineH, { top: (i + 1) * GRID_CELL }]} />
      ))}
    </View>
  );
}

/** Reachability of the typed host, shown beside the Server label. */
type Probe = { url: string; state: 'checking' | 'reachable' | 'unreachable' };

export default function LoginScreen() {
  const { theme } = useUnistyles();
  const router = useRouter();
  // iPad (and landscape phones) get a centered column instead of an edge-to-edge
  // form — a 1024pt-wide input row reads as a broken layout, not a sign-in card.
  const { width: windowWidth } = useWindowDimensions();
  const wide = windowWidth >= 600;
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
    <View style={styles.page}>
      <View pointerEvents="none" style={RNStyleSheet.absoluteFill}>
        <AuthGridPattern />
        <View style={styles.glow} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[styles.content, wide && styles.contentWide]}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.column}>
            <View style={styles.identity}>
              <Image
                source={require('../../assets/images/icon.png')}
                style={styles.appIcon}
                accessibilityIgnoresInvertColors
              />
              <Text style={styles.wordmark}>TraderMemos</Text>
            </View>

            {/* Title block stays left-aligned with the form column. */}
            <View style={styles.intro}>
              <Text style={styles.title}>{t`Sign in`}</Text>
              <Text style={styles.subtitle}>{t`Connect to your TraderMemos server.`}</Text>
            </View>

            {/* There is no TraderMemos cloud to sign up for, and nothing below
                makes sense until that is said. First-run reads this before it
                reaches a field it cannot fill. */}
            <View style={styles.notice}>
              <View style={styles.noticeIcon}>
                <Icon
                  name="externaldrive.badge.wifi"
                  size={17}
                  tintColor={theme.colors.primary}
                />
              </View>
              <View style={styles.noticeBody}>
                <Text style={styles.noticeTitle}>{t`You bring the server`}</Text>
                <Text style={styles.noticeText}>
                  {t`TraderMemos is self-hosted: this app is the client for a server you run, and every screen in it comes from that server.`}
                </Text>
                <Pressable
                  onPress={() => void Linking.openURL(DOCS_URL)}
                  accessibilityRole="link"
                  style={({ pressed }) => [styles.noticeLinkRow, pressed && styles.pressed]}
                >
                  <Text style={styles.noticeLink}>{t`How to set one up`}</Text>
                  <Icon
                    name="arrow.up.forward"
                    size={11}
                    tintColor={theme.colors.primary}
                  />
                </Pressable>
              </View>
            </View>

            <View style={styles.fields}>
              <View style={styles.field}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>{t`Server address`}</Text>
                  <ProbeChip probe={probe} />
                </View>
                <form.Field name="serverUrl">
                  {(field) => (
                    <View style={styles.inputShell}>
                      <TextInput
                        value={field.state.value}
                        onChangeText={field.handleChange}
                        onBlur={() => void checkServer(field.state.value)}
                        placeholder="https://trades.example.com"
                        placeholderTextColor={theme.colors.mutedForeground}
                        keyboardType="url"
                        textContentType="URL"
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="next"
                        onSubmitEditing={() => {
                          void checkServer(field.state.value);
                          usernameRef.current?.focus();
                        }}
                        style={styles.input}
                      />
                    </View>
                  )}
                </form.Field>
                <Text style={styles.hint}>
                  {t`Origin only — the app adds /api/v1 itself.`}
                </Text>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>{t`Username`}</Text>
                <form.Field name="username">
                  {(field) => (
                    <View style={styles.inputShell}>
                      <TextInput
                        ref={usernameRef}
                        value={field.state.value}
                        onChangeText={field.handleChange}
                        placeholder={t`Enter your username`}
                        placeholderTextColor={theme.colors.mutedForeground}
                        autoCapitalize="none"
                        autoCorrect={false}
                        textContentType="username"
                        returnKeyType="next"
                        onSubmitEditing={() => passwordRef.current?.focus()}
                        style={styles.input}
                      />
                    </View>
                  )}
                </form.Field>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>{t`Password`}</Text>
                <form.Field name="password">
                  {(field) => (
                    <View style={styles.inputShell}>
                      <PasswordInput
                        ref={passwordRef}
                        value={field.state.value}
                        onChangeText={field.handleChange}
                        placeholder={t`Enter your password`}
                        onSubmitEditing={() => void form.handleSubmit()}
                        returnKeyType="go"
                      />
                    </View>
                  )}
                </form.Field>
              </View>
            </View>

            {needsTotp ? (
              <View style={styles.card}>
                <View style={styles.field}>
                  <Text style={styles.label}>{t`Authenticator code`}</Text>
                  <form.Field name="totpCode">
                    {(field) => (
                      <View style={styles.inputShell}>
                        <TextInput
                          ref={totpRef}
                          value={field.state.value}
                          onChangeText={field.handleChange}
                          placeholder={t`6-digit code`}
                          placeholderTextColor={theme.colors.mutedForeground}
                          keyboardType="number-pad"
                          // iOS fills this straight from the Passwords app.
                          textContentType="oneTimeCode"
                          autoComplete="one-time-code"
                          maxLength={6}
                          onSubmitEditing={() => void form.handleSubmit()}
                          returnKeyType="go"
                          style={styles.input}
                        />
                      </View>
                    )}
                  </form.Field>
                </View>
              </View>
            ) : null}

            {error ? (
              <View style={[styles.card, styles.alert]}>
                <Icon
                  name="exclamationmark.circle"
                  size={18}
                  tintColor={theme.colors.destructive}
                />
                <Text selectable style={styles.alertText}>
                  {error}
                </Text>
              </View>
            ) : null}

            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(submitting) => (
                <Pressable
                  onPress={() => void form.handleSubmit()}
                  disabled={submitting}
                  accessibilityRole="button"
                  accessibilityState={{ busy: submitting }}
                  style={({ pressed }) => [styles.submit, pressed && styles.submitPressed]}
                >
                  {submitting ? (
                    <ActivityIndicator color={theme.colors.background} />
                  ) : (
                    <Text style={styles.submitText}>{t`Sign in`}</Text>
                  )}
                </Pressable>
              )}
            </form.Subscribe>

            <Text style={styles.selfHostedNote}>{t`Self-hosted — your trade data stays on your stack.`}</Text>
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
  const { theme } = useUnistyles();
  if (!probe) return null;
  if (probe.state === 'checking') {
    return (
      <View style={styles.probe}>
        <ActivityIndicator size="small" color={theme.colors.mutedForeground} />
        <Text style={styles.probeMuted}>{t`Checking…`}</Text>
      </View>
    );
  }
  const reachable = probe.state === 'reachable';
  return (
    <View style={styles.probe}>
      <Icon
        name={reachable ? 'checkmark.circle.fill' : 'exclamationmark.circle.fill'}
        size={13}
        tintColor={reachable ? theme.colors.profit : theme.colors.destructive}
      />
      <Text style={reachable ? styles.probeOk : styles.probeBad}>
        {reachable ? t`Reachable` : t`No answer`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  flex: { flex: 1 },
  page: { flex: 1, backgroundColor: theme.colors.background },
  gridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: RNStyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
    opacity: 0.4,
  },
  gridLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: RNStyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
    opacity: 0.4,
  },
  glow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    experimental_backgroundImage:
      'radial-gradient(circle at 50% 18%, rgba(4, 144, 200, 0.10) 0%, rgba(4, 144, 200, 0) 45%)',
  },
  content: { padding: theme.spacing.lg },
  // On a regular-width canvas the form floats as a centered block instead of
  // sitting in the top-left corner of a mostly empty page.
  contentWide: { flexGrow: 1, justifyContent: 'center', paddingVertical: theme.spacing.xl },
  // Fields track the reading measure, not the screen — an iPad-wide input row
  // is unusable and reads as a layout bug.
  column: {
    width: '100%',
    maxWidth: theme.measure.auth,
    alignSelf: 'center',
    gap: theme.spacing.lg,
  },
  identity: { alignItems: 'center', gap: theme.spacing.sm, paddingTop: theme.spacing.xl },
  wordmark: { fontSize: 16, fontWeight: '600', color: theme.colors.foreground },
  appIcon: {
    width: 56,
    height: 56,
    // iOS icon corner ratio (~22.4%) so the mark reads as an app icon, not a photo.
    borderRadius: 12.5,
    borderCurve: 'continuous',
  },
  intro: { gap: theme.spacing.xs, paddingTop: theme.spacing.sm },
  title: { fontSize: 28, fontWeight: '700', color: theme.colors.foreground },
  subtitle: { fontSize: 15, color: theme.colors.mutedForeground },
  // Explainer, not an alert: the card surface with a brand-tinted glyph well,
  // no destructive or warning color anywhere.
  notice: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg + 2,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.card,
    boxShadow: theme.shadows.card,
  },
  noticeIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.fill,
  },
  noticeBody: { flex: 1, gap: theme.spacing.xs },
  noticeTitle: { fontSize: 15, fontWeight: '600', color: theme.colors.foreground },
  noticeText: { fontSize: 13, lineHeight: 18, color: theme.colors.mutedForeground },
  noticeLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingTop: theme.spacing.xs,
  },
  noticeLink: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },
  pressed: { opacity: 0.6 },
  fields: { gap: theme.spacing.lg },
  field: { gap: theme.spacing.sm },
  // The label and its verdict share a baseline — the status belongs to the
  // field, not to the page, so it never becomes another banner.
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // Reference auth form: prominent label above a large, standalone filled field.
  label: { fontSize: 16, fontWeight: '600', color: theme.colors.foreground },
  probe: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
  probeMuted: { fontSize: 13, color: theme.colors.mutedForeground },
  probeOk: { fontSize: 13, fontWeight: '600', color: theme.colors.profit },
  probeBad: { fontSize: 13, fontWeight: '600', color: theme.colors.destructive },
  hint: { fontSize: 12, color: theme.colors.mutedForeground },
  inputShell: {
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.lg + 2,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: theme.colors.input,
    backgroundColor: theme.colors.card,
  },
  input: { fontSize: 17, paddingVertical: theme.spacing.sm, color: theme.colors.foreground },
  card: {
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.card,
  },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  alertText: { flex: 1, fontSize: 14, color: theme.colors.destructive },
  // High-contrast pill CTA per the reference (white on black in dark mode).
  submit: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.foreground,
  },
  submitPressed: { opacity: 0.8 },
  submitText: { fontSize: 17, fontWeight: '600', color: theme.colors.background },
  selfHostedNote: {
    fontSize: 12,
    color: theme.colors.mutedForeground,
    textAlign: 'center',
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xl,
  },
}));
