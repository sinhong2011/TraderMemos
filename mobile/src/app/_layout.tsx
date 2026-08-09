import { I18nProvider } from '@lingui/react';
import { QueryClient, useQueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import * as Application from 'expo-application';
import * as Linking from 'expo-linking';
import { DarkTheme, DefaultTheme, ThemeProvider, useRootNavigationState, useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useMemo, useRef } from 'react';
import { Alert, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useUnistyles } from 'react-native-unistyles';

import { ApiError, UnauthorizedError } from '@/api/client';
import { useSession } from '@/api/session';
import { SessionProvider } from '@/api/session-provider';
import { AppErrorBoundary } from '@/components/error-boundary';
import { OfflineBanner } from '@/components/error-state';
import { i18n } from '@/i18n';
import { t } from '@lingui/core/macro';
import { useConnectivityStore } from '@/lib/connectivity';
import { useResolvedScheme } from '@/lib/prefs';
import { useTradingSessionSync } from '@/lib/live-activity';
import { usePrefsSync } from '@/lib/use-prefs-sync';
import { useWidgetSnapshotSync } from '@/lib/widget-snapshot';
import { ensureDropFolder, stageDroppedFile } from '@/lib/trade-import';
import { useOutboxDrain } from '@/lib/use-outbox';
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

/**
 * Feeds the Home/Lock Screen widgets: pushes the shared App Group snapshot
 * (today's P&L, open positions, loss budget) whenever the underlying queries
 * change, and clears it on sign-out — see `lib/widget-snapshot.ts`.
 */
function WidgetSnapshotGate() {
  useWidgetSnapshotSync();
  return null;
}

/**
 * Keeps the Lock Screen / Dynamic Island trading session honest: mirrors the
 * shared today-state into the Live Activity while one is running, and ends it
 * on sign-out or a new market day — see `lib/live-activity.ts`.
 */
function LiveActivityGate() {
  useTradingSessionSync();
  return null;
}

/**
 * Replays the offline write queue (notes and quick-journal saves made while
 * the server was unreachable) on launch, recovery and foreground — see
 * `lib/outbox.ts`. Mounted before ReachabilityGate so a recovery drains the
 * queue before the refetch storm starts; the pending-note overlay keeps the
 * lists coherent either way.
 */
function OutboxGate() {
  useOutboxDrain();
  return null;
}

/**
 * Pulls the app back to life when the server starts answering again.
 *
 * The reachability poll in `lib/connectivity` is what notices; without this
 * the user would be looking at a screen whose queries have already exhausted
 * their retries, and the banner would vanish while the content stayed dead
 * until they thought to pull to refresh.
 */
function ReachabilityGate() {
  const queryClient = useQueryClient();
  const recoveredAt = useConnectivityStore((state) => state.recoveredAt);

  useEffect(() => {
    if (recoveredAt === 0) return;
    void queryClient.refetchQueries({ type: 'active' });
  }, [recoveredAt, queryClient]);

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
            retry: (failureCount, error) => {
              // A dead session won't recover by retrying — the gate redirects instead.
              if (error instanceof UnauthorizedError) return false;
              // The server understood and refused; asking again changes nothing,
              // and each pointless attempt is another second of skeleton.
              if (error instanceof ApiError && error.status < 500) return false;
              return failureCount < 2;
            },
            // Tighter than the 1s-and-doubling default. These retries sit
            // between the user and the error state, so they have to be over
            // fast: an unreachable server should be *shown* as unreachable in
            // about a second and a half, not five.
            retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4_000),
            // Default staleness rules, with one exception: a query that failed
            // while the server was down must not stay failed when the user
            // navigates back to it, even if `staleTime` says it is fresh.
            refetchOnMount: (query) => (query.state.error != null ? 'always' : true),
          },
          // Mutations keep TanStack's no-retry default, deliberately. A
          // `NetworkError` means no response came back — not that the request
          // never landed — so replaying a POST /trades can book the trade
          // twice. In a journal whose whole value is an accurate ledger, a
          // second Save tap is far cheaper than a phantom fill.
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
          <WidgetSnapshotGate />
          <LiveActivityGate />
          <OutboxGate />
          <ReachabilityGate />
          <AppErrorBoundary>
          <View style={{ flex: 1 }}>
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
                pushed screen under (dashboard). */}
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
          {/* Above the navigator, so it stays put across pushes and sheets. */}
          <OfflineBanner />
          </View>
          </AppErrorBoundary>
        </ThemeProvider>
        </PersistQueryClientProvider>
      </SessionProvider>
    </I18nProvider>
    </GestureHandlerRootView>
  );
}
