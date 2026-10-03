import { useRouter } from 'expo-router';
import { Progress } from 'panelui-native';
import { Pressable, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { DashboardCard } from '@/components/dashboard-card';
import { Icon } from '@/components/icon';
import { t } from '@lingui/core/macro';
import { formatCountdown, triggerSentence, useCooldownClock, useCooldownLock } from '@/lib/cooldown';

/**
 * The open cooldown on Home: the clock, how far along it is, and why it
 * started. Renders nothing when no session is open — like DailyLossCard, the
 * card exists to hold a line, not to advertise the feature (that lives in the
 * tools menu and on the Trades "+").
 */
export function CooldownCard() {
  const [mutedForeground] = useCSSVariable(['--color-muted-foreground']) as [string];
  const router = useRouter();
  const { session } = useCooldownLock();
  const clock = useCooldownClock(session);

  if (!session) return null;

  const elapsed = Math.max(0, session.duration_sec - clock.remaining);
  const pct = session.duration_sec > 0 ? (elapsed / session.duration_sec) * 100 : 100;

  return (
    <DashboardCard title={t`Cooldown`}>
      <Pressable
        onPress={() => router.push('/cooldown')}
        accessibilityRole="button"
        accessibilityLabel={t`Open cooldown`}
        className="gap-3 active:opacity-70"
      >
        <View className="flex-row items-baseline gap-2">
          <Text className="text-[22px] font-bold text-foreground tabular-nums">
            {clock.phase === 'gate' ? t`Done` : formatCountdown(clock.remaining)}
          </Text>
          <Text className="flex-1 text-[13px] text-muted-foreground" numberOfLines={1}>
            {clock.phase === 'gate' ? t`Answer the return gate` : triggerSentence(session.trigger)}
          </Text>
          <Icon name="chevron.right" size={12} tintColor={mutedForeground} />
        </View>
        <Progress value={Math.max(pct, 3)} size="sm" color={clock.phase === 'gate' ? 'success' : 'primary'} />
      </Pressable>
    </DashboardCard>
  );
}
