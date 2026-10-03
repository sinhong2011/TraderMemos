import { usePathname, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';

import { useSession } from '@/api/session';
import { Icon } from '@/components/icon';
import { t } from '@lingui/core/macro';
import { formatCountdown, useCooldownClock, useCooldownLock } from '@/lib/cooldown';

/**
 * App-wide "cooling down" capsule, the OfflineBanner's twin: floats clear of
 * the tab bar on every screen while a session is open, so the lock is never a
 * surprise when the trade form refuses to open. Tapping it opens the cooldown
 * screen; it hides on that screen itself, where the same clock is the hero.
 */
export function CooldownBanner() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const [primary] = useCSSVariable(['--color-primary']) as [string];
  const { session: auth } = useSession();
  const { session } = useCooldownLock();
  const clock = useCooldownClock(session);

  if (!session || auth == null || pathname === '/cooldown') return null;

  return (
    <View
      className="absolute left-0 right-0 items-center"
      pointerEvents="box-none"
      // Clear of the tab bar (see OfflineBanner for the 49pt).
      style={{ bottom: insets.bottom + 49 + 8 }}
    >
      <Pressable
        onPress={() => router.push('/cooldown')}
        accessibilityRole="button"
        accessibilityLabel={t`Open cooldown`}
        className="flex-row items-center gap-2 rounded-full border border-border bg-card px-3 py-2 active:opacity-70"
        style={{ boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.18)' }}
      >
        <Icon name="timer" size={13} tintColor={primary} />
        <Text className="text-[13px] font-medium text-foreground" numberOfLines={1}>
          {clock.phase === 'gate' ? t`Cooldown over — answer the gate` : t`Cooling down`}
        </Text>
        {clock.phase === 'counting' ? (
          <Text className="text-[13px] tabular-nums text-muted-foreground">
            {formatCountdown(clock.remaining)}
          </Text>
        ) : null}
      </Pressable>
    </View>
  );
}
