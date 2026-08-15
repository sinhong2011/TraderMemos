/**
 * The app's failure surfaces. Three sizes, one vocabulary — all of them read
 * their copy from `describeError`, so a screen never decides how to phrase a
 * dropped connection and no screen can leak a raw exception again.
 *
 * - `ErrorState`   — the screen has nothing to show. Replaces the content.
 * - `InlineError`  — one card or section of a screen failed; the rest is fine.
 * - `OfflineBanner`— the server is unreachable app-wide; mounted once, at the root.
 *
 * `ErrorState` uses the same `EmptyState` as the empty screens so a failed
 * screen and an empty screen are visibly the same species of "nothing here",
 * differing only in icon, copy, and the presence of an action.
 */

import { t } from '@lingui/core/macro';
import { type SFSymbol } from 'expo-symbols';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';
import { create } from 'zustand';

import { NetworkError } from '@/api/client';
import { useSession } from '@/api/session';
import { EmptyState } from '@/components/empty-state';
import { GlassButton } from '@/components/glass-button';
import { Icon } from '@/components/icon';
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
    <View className="flex-1 items-center justify-center gap-4 bg-background px-6">
      {/* The wrapper carries no `flex-1` of its own, so it hugs the empty
          state and the button lands directly under the description as one
          centred group. Letting it flex instead pins the button to the bottom
          of the screen, where the tab bar and the offline banner sit on it. */}
      <View className="w-full">
        <EmptyState title={title} systemImage={systemImage} description={description} />
      </View>
      {showRetry ? (
        <GlassButton
          label={retrying ? t`Retrying…` : t`Try again`}
          systemImage="arrow.clockwise"
          disabled={retrying}
          onPress={onRetry}
        />
      ) : action ? (
        <GlassButton
          label={action.label}
          systemImage={action.systemImage}
          onPress={action.onPress}
        />
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
  const [mutedForeground] = useCSSVariable(['--color-muted-foreground']) as [string];
  const { title, systemImage, retryable } = describeError(error);

  return (
    <View className="flex-row items-center gap-2 py-1">
      <Icon name={systemImage} size={15} tintColor={mutedForeground} />
      <Text className="flex-1 text-[13px] text-muted-foreground" numberOfLines={2}>
        {title}
      </Text>
      {onRetry != null && retryable ? (
        <Pressable onPress={onRetry} accessibilityRole="button" hitSlop={8}>
          <Text className="text-[13px] font-semibold text-primary">{t`Retry`}</Text>
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
 * it — a banner that reflows the page fights every large-title screen and
 * every scroll inset in the app. It renders nothing while the server answers,
 * so the common case costs one store read.
 */
export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const [mutedForeground] = useCSSVariable(['--color-muted-foreground']) as [string];
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
    <View
      className="absolute left-0 right-0 items-center"
      pointerEvents="none"
      // Clear of the tab bar. Native tabs expose no height to JS, so this is
      // the standard 49pt bar plus the home-indicator inset the bar sits on.
      style={{ bottom: insets.bottom + 49 + 8 }}
    >
      <View
        className="flex-row items-center gap-2 rounded-full border border-border bg-card px-3 py-2"
        style={{ boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.18)' }}
      >
        <Icon name="wifi.slash" size={13} tintColor={mutedForeground} />
        <Text className="text-[13px] font-medium text-foreground" numberOfLines={1}>
          {serverHost ? t`Can't reach ${serverHost}` : t`Can't reach the server`}
        </Text>
        {pending > 0 ? (
          <Text className="text-[13px] tabular-nums text-muted-foreground" numberOfLines={1}>
            {pending === 1 ? t`1 change queued` : t`${pending} changes queued`}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
