import { I18nProvider } from '@lingui/react';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import * as Application from 'expo-application';
import * as Linking from 'expo-linking';
import { DarkTheme, DefaultTheme, ThemeProvider, useRootNavigationState, useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useMemo, useRef } from 'react';
import { Alert } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useUnistyles } from 'react-native-unistyles';

import { UnauthorizedError } from '@/api/client';
import { useSession } from '@/api/session';
import { SessionProvider } from '@/api/session-provider';
import { i18n } from '@/i18n';
import { t } from '@lingui/core/macro';
import { useResolvedScheme } from '@/lib/prefs';
import { usePrefsSync } from '@/lib/use-prefs-sync';
import { ensureDropFolder, stageDroppedFile } from '@/lib/trade-import';
import { queryPersister } from '@/storage/mmkv';

// Hold the native splash through the SecureStore session read so cold start
// goes splash → first real screen (tabs or login), never a spinner or a flash
// of the wrong route. Must run at module scope — inside a component it can
// race the auto-hide.
SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ fade: true, duration: 350 });

function SplashGate() {
  const { isLoading } = useSession();
  useEffect(() => {
    if (!isLoading) SplashScreen.hide();
  }, [isLoading]);
  return null;
}

/**
 * Files handed to the app by another app — a share-sheet "Open in
 * TraderMemos", or an iOS Shortcut that saves a broker screenshot into the
 * app's Import folder — arrive as `file://` URLs that match no route. Stage
 * them in the drop folder and open the trade form on them instead; the folder
 * itself is created up front so Shortcuts can pick it as a save destination
 * before the first import.
 */
function ImportLinkGate() {
  const router = useRouter();
  const { session, isLoading } = useSession();
  const navigationState = useRootNavigationState();
  const ready = navigationState?.key != null && !isLoading;
  // getInitialURL resolves again whenever the session settles; a URL is a
  // one-shot hand-off, so remember what has already been staged.
  const staged = useRef(new Set<string>());

  useEffect(() => {
    ensureDropFolder();
  }, []);

  useEffect(() => {
    if (!ready) return;
    const handle = (url: string | null) => {
      if (!url?.startsWith('file://') || staged.current.has(url)) return;
      staged.current.add(url);
      try {
        if (!stageDroppedFile(url)) return;
      } catch (err) {
        Alert.alert(t`Could not open file`, err instanceof Error ? err.message : String(err));
        return;
      }
      if (session) router.push({ pathname: '/new-trade', params: { import: '1' } });
      // Signed out the drop keeps: the form drains the folder after login.
      else router.push('/login');
    };
    void Linking.getInitialURL().then(handle);
    const subscription = Linking.addEventListener('url', (event) => handle(event.url));
    return () => subscription.remove();
  }, [ready, router, session]);

  return null;
}

/**
 * Account-level preferences (timezones, clock, currency, screenshots cap)
 * pull on sign-in and push on change — see `lib/prefs-sync.ts` for what
 * syncs and why the rest stays on this device.
 */
function PrefsSyncGate() {
  usePrefsSync();
  return null;
}

export default function RootLayout() {
  // The Appearance pref, not the device scheme: pinning the app to Light on a
  // phone in Dark Mode has to move the navigation chrome too, or the headers
  // and back buttons stay dark over light screens.
  const scheme = useResolvedScheme();
  const { theme } = useUnistyles();
  // Feed the design tokens into navigation so every screen background,
  // header, and tint matches the web app instead of the UIKit defaults.
  const navTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        // Nav "primary" tints interactive text/icons (back button, header
        // actions) — brand blue is reserved for fills, so keep chrome neutral.
        primary: theme.colors.foreground,
        background: theme.colors.background,
        card: theme.colors.card,
        text: theme.colors.foreground,
        border: theme.colors.border,
      },
    };
  }, [scheme, theme]);
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            // Keep entries alive long enough to be worth persisting — must be
            // >= the persister maxAge or restored data is GC'd immediately.
            gcTime: 24 * 60 * 60 * 1000,
            // A dead session won't recover by retrying — the gate redirects instead.
            retry: (failureCount, error) =>
              !(error instanceof UnauthorizedError) && failureCount < 2,
          },
        },
      }),
    [],
  );
  const persistOptions = useMemo(
    () => ({
      persister: queryPersister,
      maxAge: 24 * 60 * 60 * 1000,
      // Drop the snapshot across app updates — the hand-written API types can
      // drift between versions and stale shapes would render garbage.
      buster: Application.nativeApplicationVersion ?? 'dev',
    }),
    [],
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <I18nProvider i18n={i18n}>
      <SessionProvider>
        <SplashGate />
        <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <ThemeProvider value={navTheme}>
          <ImportLinkGate />
          <PrefsSyncGate />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="login" options={{ presentation: 'modal', headerShown: false }} />
            {/* New trade is a destination, not an interruption: a real push
                with the standard back gesture. Edit stays a page sheet (not
                formSheet: react-native-screens' formSheet lays the ScrollView
                out over the header with these full-height forms). */}
            <Stack.Screen name="new-trade" />
            {/* Review & save rides the same push stack as the form. */}
            <Stack.Screen name="trade-preview" />

            <Stack.Screen name="edit-trade" options={{ presentation: 'modal' }} />
            <Stack.Screen
              name="manage-tags"
              options={{
                presentation: 'formSheet',
                sheetAllowedDetents: [0.6, 1],
                sheetGrabberVisible: true,
                sheetCornerRadius: 24,
              }}
            />
            {/* Was a formSheet, and hit the same overlap as the trade forms
                above: the ScrollView drew "Review notes" straight over the
                Cancel/Save chrome, leaving no way to save the entry. */}
            <Stack.Screen name="quick-journal" options={{ presentation: 'modal' }} />
            <Stack.Screen name="new-note" options={{ presentation: 'modal' }} />
            <Stack.Screen name="edit-note" options={{ presentation: 'modal' }} />
            <Stack.Screen name="new-setup" options={{ presentation: 'modal' }} />
            {/* Replay is a thing you watch, not a form you fill: full screen so
                the chart gets the height, with its own header for the actions. */}
            <Stack.Screen
              name="replay"
              options={{ presentation: 'fullScreenModal', headerShown: true }}
            />
            {/* One-shot calculators ride in half sheets; the R calculator is a
                pushed screen under (reports). */}
            <Stack.Screen
              name="tool-position-size"
              options={{
                presentation: 'formSheet',
                sheetAllowedDetents: [0.6, 1],
                sheetGrabberVisible: true,
                sheetCornerRadius: 24,
              }}
            />
            <Stack.Screen
              name="tool-kelly"
              options={{
                presentation: 'formSheet',
                sheetAllowedDetents: [0.6, 1],
                sheetGrabberVisible: true,
                sheetCornerRadius: 24,
              }}
            />
            <Stack.Screen
              name="tool-fx"
              options={{
                presentation: 'formSheet',
                sheetAllowedDetents: [0.6, 1],
                sheetGrabberVisible: true,
                sheetCornerRadius: 24,
              }}
            />
            <Stack.Screen
              name="share-trade"
              options={{
                presentation: 'formSheet',
                sheetAllowedDetents: [0.75, 1],
                sheetGrabberVisible: true,
                sheetCornerRadius: 24,
              }}
            />
            {/* Add/edit cash transaction — a creation sheet like new-token,
                launched from the Funding list's + button. Taller detent than
                the token sheet: five stacked fields, not two. */}
            <Stack.Screen
              name="cash-form"
              options={{
                presentation: 'formSheet',
                sheetAllowedDetents: [0.75, 1],
                sheetGrabberVisible: true,
                sheetCornerRadius: 24,
              }}
            />
            <Stack.Screen
              name="new-token"
              options={{
                presentation: 'formSheet',
                sheetAllowedDetents: [0.55, 1],
                sheetGrabberVisible: true,
                sheetCornerRadius: 24,
              }}
            />
            {/* Add/edit tag — the Tags list's + button, same sheet as above;
                the swatch row makes it one detent taller. */}
            <Stack.Screen
              name="tag-form"
              options={{
                presentation: 'formSheet',
                sheetAllowedDetents: [0.6, 1],
                sheetGrabberVisible: true,
                sheetCornerRadius: 24,
              }}
            />
          </Stack>
        </ThemeProvider>
        </PersistQueryClientProvider>
      </SessionProvider>
    </I18nProvider>
    </GestureHandlerRootView>
  );
}
