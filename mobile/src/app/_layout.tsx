import { I18nProvider } from '@lingui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useUnistyles } from 'react-native-unistyles';

import { UnauthorizedError } from '@/api/client';
import { SessionProvider } from '@/api/session-provider';
import { i18n } from '@/i18n';

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
            // A dead session won't recover by retrying — the gate redirects instead.
            retry: (failureCount, error) =>
              !(error instanceof UnauthorizedError) && failureCount < 2,
          },
        },
      }),
    [],
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <I18nProvider i18n={i18n}>
      <SessionProvider>
        <QueryClientProvider client={queryClient}>
        <ThemeProvider value={navTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="login" options={{ presentation: 'modal', headerShown: false }} />
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
            <Stack.Screen
              name="quick-journal"
              options={{
                presentation: 'formSheet',
                sheetAllowedDetents: [0.75, 1],
                sheetGrabberVisible: true,
                sheetCornerRadius: 24,
              }}
            />
            <Stack.Screen name="new-note" options={{ presentation: 'modal' }} />
            <Stack.Screen name="new-setup" options={{ presentation: 'modal' }} />
          </Stack>
        </ThemeProvider>
        </QueryClientProvider>
      </SessionProvider>
    </I18nProvider>
    </GestureHandlerRootView>
  );
}
