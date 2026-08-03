import { I18nProvider } from '@lingui/react';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import * as Application from 'expo-application';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router/stack';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useUnistyles } from 'react-native-unistyles';

import { UnauthorizedError } from '@/api/client';
import { useSession } from '@/api/session';
import { SessionProvider } from '@/api/session-provider';
import { i18n } from '@/i18n';
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

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { theme } = useUnistyles();
  // Feed the design tokens into navigation so every screen background,
  // header, and tint matches the web app instead of the UIKit defaults.
  const navTheme = useMemo(() => {
    const base = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
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
  }, [colorScheme, theme]);
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
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="login" options={{ presentation: 'modal', headerShown: false }} />
            {/* Page sheets, not formSheet: react-native-screens' formSheet
                lays the ScrollView out over the header (content overlaps the
                chrome) with these full-height forms — see worktree notes. */}
            <Stack.Screen name="new-trade" options={{ presentation: 'modal' }} />
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
          </Stack>
        </ThemeProvider>
        </PersistQueryClientProvider>
      </SessionProvider>
    </I18nProvider>
    </GestureHandlerRootView>
  );
}
