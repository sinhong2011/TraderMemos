import {
  BottomSheet,
  Button as UIButton,
  Group,
  Image as UIImage,
  Text as UIText,
  TextField,
  useNativeState,
  VStack,
} from '@expo/ui/swift-ui';
import {
  autocorrectionDisabled,
  background,
  buttonStyle,
  controlSize,
  cornerRadius,
  font,
  foregroundStyle,
  frame,
  keyboardType,
  multilineTextAlignment,
  padding,
  presentationDetents,
  presentationDragIndicator,
  textContentType,
  textInputAutocapitalization,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { useForm } from '@tanstack/react-form';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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

import { login, ping } from '@/api/client';
import { PasswordInput } from '@/components/password-input';
import { loadServerUrl, normalizeServerUrl, useSession } from '@/api/session';
import { t } from '@lingui/core/macro';
import { AppHost } from '@/components/app-host';

const GRID_CELL = 44;

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

export default function LoginScreen() {
  const { theme } = useUnistyles();
  const router = useRouter();
  // iPad (and landscape phones) get a centered column instead of an edge-to-edge
  // form — a 1024pt-wide input row reads as a broken layout, not a sign-in card.
  const { width: windowWidth } = useWindowDimensions();
  const wide = windowWidth >= 600;
  const { signIn } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // The sheet's SwiftUI TextField binds to this observable; the form mirrors it
  // via onTextChange so submit and the Advanced row see every keystroke.
  const serverState = useNativeState('');

  const passwordRef = useRef<TextInput>(null);

  // TanStack Form, same stack as web — the reference pattern for upcoming
  // forms (new trade, settings, notes). Server-side failures stay in local
  // state since they come from the API, not field validation.
  const form = useForm({
    defaultValues: { serverUrl: '', username: '', password: '' },
    onSubmit: async ({ value }) => {
      // The CTA stays enabled and validates on tap — feedback beats a dead button.
      if (!value.username.trim() || !value.password) {
        setError(t`Enter your username and password`);
        return;
      }
      const normalized = normalizeServerUrl(value.serverUrl);
      if (!normalized) {
        setError(t`Enter your TraderMemos server URL`);
        setAdvancedOpen(true);
        return;
      }
      setError(null);
      try {
        // Probe /healthz first so a bad host reports "unreachable" rather than
        // surfacing as a confusing credentials failure.
        if (!(await ping(normalized))) {
          setError(t`Could not reach ${normalized}`);
          return;
        }
        const tokens = await login(normalized, {
          email: value.username.trim(),
          password: value.password,
        });
        await signIn({
          serverUrl: normalized,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
        });
        router.replace('/');
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : t`Sign in failed`);
      }
    },
  });

  // Prefill the last host so a re-login after token expiry doesn't retype it.
  useEffect(() => {
    void loadServerUrl().then((saved) => {
      if (saved) {
        form.setFieldValue('serverUrl', saved);
        serverState.set(saved);
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
              <Text style={styles.subtitle}>{t`Welcome back.`}</Text>
            </View>

            <View style={styles.fields}>
              <View style={styles.field}>
                <Text style={styles.label}>{t`Username`}</Text>
                <form.Field name="username">
                  {(field) => (
                    <View style={styles.inputShell}>
                      <TextInput
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

            {error ? (
              <View style={[styles.card, styles.alert]}>
                <SymbolView
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

            <Pressable
              onPress={() => setAdvancedOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={t`Advanced`}
              style={({ pressed }) => [styles.advanced, pressed && styles.advancedPressed]}
            >
              <SymbolView name="gearshape" size={13} tintColor={theme.colors.mutedForeground} />
              <Text style={styles.advancedText}>{t`Advanced`}</Text>
            </Pressable>

            <Text style={styles.selfHostedNote}>{t`Self-hosted — your trade data stays on your stack.`}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <AppHost style={styles.sheetHost}>
        <BottomSheet isPresented={advancedOpen} onIsPresentedChange={setAdvancedOpen}>
          <Group
            modifiers={[
              presentationDetents([{ height: 380 }]),
              presentationDragIndicator('visible'),
            ]}
          >
            <VStack
              alignment="center"
              spacing={0}
              modifiers={[padding({ horizontal: 24, top: 32, bottom: 24 })]}
            >
              <UIImage
                systemName="externaldrive.badge.wifi"
                size={28}
                color={theme.colors.foreground}
                modifiers={[
                  frame({ width: 60, height: 60 }),
                  background('rgba(4, 144, 200, 0.15)'),
                  cornerRadius(15),
                ]}
              />
              <UIText
                modifiers={[padding({ top: 14 }), font({ size: 20, weight: 'semibold' })]}
              >
                {t`API server`}
              </UIText>
              <UIText
                modifiers={[
                  padding({ top: 6 }),
                  font({ size: 14 }),
                  foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                  multilineTextAlignment('center'),
                ]}
              >
                {t`Point the app at your own TraderMemos instance.\nOrigin only — /api/v1 is added automatically.`}
              </UIText>
              <TextField
                text={serverState}
                autoFocus
                placeholder="https://trades.example.com"
                onTextChange={(text) => form.setFieldValue('serverUrl', text)}
                modifiers={[
                  keyboardType('url'),
                  textContentType('URL'),
                  textInputAutocapitalization('never'),
                  autocorrectionDisabled(),
                  padding({ horizontal: 14, vertical: 13 }),
                  background('rgba(120, 120, 128, 0.16)'),
                  cornerRadius(12),
                  padding({ top: 24 }),
                ]}
              />
              <UIButton
                onPress={() => setAdvancedOpen(false)}
                modifiers={[
                  buttonStyle('borderedProminent'),
                  controlSize('large'),
                  tint(theme.colors.primary),
                  padding({ top: 16 }),
                ]}
              >
                <UIText
                  modifiers={[frame({ maxWidth: 9999 }), font({ size: 17, weight: 'semibold' })]}
                >
                  {t`Done`}
                </UIText>
              </UIButton>
            </VStack>
          </Group>
        </BottomSheet>
      </AppHost>
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
  intro: { gap: theme.spacing.xs, paddingTop: theme.spacing.sm, paddingBottom: theme.spacing.lg },
  title: { fontSize: 28, fontWeight: '700', color: theme.colors.foreground },
  subtitle: { fontSize: 15, color: theme.colors.mutedForeground },
  fields: { gap: theme.spacing.lg },
  field: { gap: theme.spacing.sm },
  // Reference auth form: prominent label above a large, standalone filled field.
  label: { fontSize: 16, fontWeight: '600', color: theme.colors.foreground },
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
  advanced: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    minHeight: 44,
  },
  advancedPressed: { opacity: 0.6 },
  advancedText: { fontSize: 15, color: theme.colors.mutedForeground },
  selfHostedNote: {
    fontSize: 12,
    color: theme.colors.mutedForeground,
    textAlign: 'center',
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xl,
  },
  sheetHost: { position: 'absolute', width: 0, height: 0 },
}));
