/**
 * The app's failure surfaces. Three sizes, one vocabulary — all of them read
 * their copy from `describeError`, so a screen never decides how to phrase a
 * dropped connection and no screen can leak a raw exception again.
 *
 * - `ErrorState`   — the screen has nothing to show. Replaces the content.
 * - `InlineError`  — one card or section of a screen failed; the rest is fine.
 * - `OfflineBanner`— the server is unreachable app-wide; mounted once, at the root.
 *
 * `ErrorState` uses the same native `ContentUnavailableView` as the empty
 * states so a failed screen and an empty screen are visibly the same species
 * of "nothing here", differing only in icon, copy, and the presence of an
 * action. SwiftUI's view takes no action slot, hence the button beneath it.
 */

import { ContentUnavailableView } from '@expo/ui/swift-ui';
import { t } from '@lingui/core/macro';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { create } from 'zustand';

import { NetworkError } from '@/api/client';
import { useSession } from '@/api/session';
import { AppHost } from '@/components/app-host';
import { GlassButton } from '@/components/glass-button';
import { useServerHost, useServerUnreachable } from '@/lib/connectivity';
import { describeError } from '@/lib/errors';
import { usePendingCount } from '@/lib/outbox';

/**
 * Full-screen network `ErrorState`s announce themselves here so the banner can
 * yield: when the visible screen already *is* the "can't reach the server"
 * message, a capsule repeating it underneath is noise. The banner's real job —
 * flagging stale cached data on otherwise-working screens — is untouched, and
 * `InlineError` deliberately doesn't register (a screen that is only partly
 * broken is exactly the case the banner exists for).
 */
const useNetworkErrorScreens = create<{ count: number }>(() => ({ count: 0 }));

function useAnnounceNetworkErrorScreen(active: boolean) {
  useEffect(() => {
    if (!active) return;
    useNetworkErrorScreens.setState((s) => ({ count: s.count + 1 }));
    return () => useNetworkErrorScreens.setState((s) => ({ count: s.count - 1 }));
  }, [active]);
}

export function ErrorState({
  error,
  onRetry,
  retrying,
  action,
}: {
  error: unknown;
  /** Omit for failures the user can't act on from here (403, 404). */
  onRetry?: () => void;
  /** Disables the button while the refetch is in flight. */
  retrying?: boolean;
  /**
   * Way out for failures a retry can't fix — "Back to trades" on a deleted
   * record. Only shown when the error is *not* retryable, so a screen never
   * has to choose between the two.
   */
  action?: { label: string; systemImage?: SFSymbol; onPress: () => void };
}) {
  const { title, description, systemImage, retryable } = describeError(error);
  const showRetry = onRetry != null && retryable;
  useAnnounceNetworkErrorScreen(error instanceof NetworkError);

  return (
    <View style={styles.screen}>
      {/* `matchContents` vertically, so the host hugs the native view and the
          button lands directly under the description as one centred group.
          Letting the host flex instead pinned the button to the bottom of the
          screen, where the tab bar and the offline banner sit on top of it. */}
      <AppHost matchContents={{ vertical: true }}>
        <ContentUnavailableView
          title={title}
          systemImage={systemImage}
          description={description}
        />
      </AppHost>
      {showRetry ? (
        <View style={styles.action}>
          <GlassButton
            label={retrying ? t`Retrying…` : t`Try again`}
            systemImage="arrow.clockwise"
            disabled={retrying}
            onPress={onRetry}
          />
        </View>
      ) : action ? (
        <View style={styles.action}>
          <GlassButton
            label={action.label}
            systemImage={action.systemImage}
            onPress={action.onPress}
          />
        </View>
      ) : null}
    </View>
  );
}

/**
 * Card-sized failure: an icon, one line, and a text retry. Sized to sit inside
 * a `DashboardCard` or a report section without pushing the layout around, so
 * a single dead widget doesn't cost the user the whole screen.
 */
export function InlineError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { title, systemImage, retryable } = describeError(error);

  return (
    <View style={styles.inline}>
      <SymbolView name={systemImage} size={15} tintColor={styles.inlineIcon.color} />
      <Text style={styles.inlineLabel} numberOfLines={2}>
        {title}
      </Text>
      {onRetry != null && retryable ? (
        <Pressable onPress={onRetry} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.inlineAction}>{t`Retry`}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * App-wide "the server is down" capsule. This is the piece that keeps a
 * *partly* working screen honest: cached trades still render, the numbers look
 * live, and without this there is nothing telling the user they are reading
 * yesterday's data.
 *
 * Bottom-anchored, floating clear of the content rather than inserted above
 * it — a banner that reflows the page fights every `headerLargeTitle` screen
 * and every scroll inset in the app. It renders nothing while the server
 * answers, so the common case costs one store read.
 */
export function OfflineBanner() {
  const { session } = useSession();
  const unreachable = useServerUnreachable();
  const serverHost = useServerHost();
  // A mounted full-screen network ErrorState already says all of this.
  const covered = useNetworkErrorScreens((s) => s.count > 0);
  // Journaling writes made while unreachable wait in the offline outbox —
  // the banner is where the user learns they're queued, not lost.
  const pending = usePendingCount();
  // Signed out, the login form is *about* reaching the server and says so in
  // its own alert card — a second, vaguer notice floating over it is noise.
  if (!unreachable || session == null || covered) return null;

  return (
    <View style={styles.bannerWrap} pointerEvents="none">
      <View style={styles.banner}>
        <SymbolView name="wifi.slash" size={13} tintColor={styles.bannerIcon.color} />
        <Text style={styles.bannerLabel} numberOfLines={1}>
          {serverHost ? t`Can't reach ${serverHost}` : t`Can't reach the server`}
        </Text>
        {pending > 0 ? (
          <Text style={styles.bannerQueued} numberOfLines={1}>
            {pending === 1 ? t`1 change queued` : t`${pending} changes queued`}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  screen: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    backgroundColor: theme.colors.background,
  },
  action: { alignItems: 'center', marginTop: theme.spacing.lg },

  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  inlineIcon: { color: theme.colors.mutedForeground },
  inlineLabel: { flex: 1, fontSize: 13, color: theme.colors.mutedForeground },
  inlineAction: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },

  bannerWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    // Clear of the tab bar. Native tabs expose no height to JS, so this is the
    // standard 49pt bar plus the home-indicator inset the bar sits on.
    bottom: rt.insets.bottom + 49 + theme.spacing.sm,
    alignItems: 'center',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.full,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.18)',
  },
  bannerIcon: { color: theme.colors.mutedForeground },
  bannerLabel: { fontSize: 13, fontWeight: '500', color: theme.colors.foreground },
  bannerQueued: { fontSize: 13, color: theme.colors.mutedForeground, ...theme.numeric },
}));
