import { useRouter } from 'expo-router';
import { Progress } from 'panelui-native';
import { Pressable, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { Icon } from '@/components/icon';
import { DashboardCard } from '@/components/dashboard-card';
import { t } from '@lingui/core/macro';
import { useChecklistRun } from '@/lib/use-checklist-run';

/**
 * Today's checklist on Home, as a summary: count, progress, and the next open
 * item. The boxes themselves live on the Daily checklist screen — a seven-row
 * tick list was the tallest thing on a dashboard whose subject is the curve.
 *
 * This card is the run's one always-mounted home, so it owns the Reminders
 * mirror (`sync`) even though the ticking happens a push away.
 *
 * Renders nothing until a template exists — the card is a routine to work
 * through, not a prompt to go set one up (DailyLossCard's rule). Off-days hide
 * it rather than showing an untouched 0/7 — an unrun checklist on a Saturday
 * reads as a routine you skipped.
 */
export function ChecklistCard() {
  // Icon tints are JS values, so they come from the tokens rather than a class.
  const [mutedForeground] = useCSSVariable(['--color-muted-foreground']) as [string];
  const router = useRouter();
  const { rows, done, hasTemplate, offDay } = useChecklistRun({ sync: true });

  if (!hasTemplate || offDay) return null;

  const next = rows.find((row) => !row.done);

  return (
    <DashboardCard
      title={t`Daily checklist`}
      action={{
        label: t`Edit`,
        onPress: () => router.push('/(tabs)/(dashboard)/checklist'),
      }}
    >
      <Pressable
        onPress={() => router.push('/(tabs)/(dashboard)/daily-checklist')}
        accessibilityRole="button"
        accessibilityLabel={t`Daily checklist`}
        className="gap-3 active:opacity-70"
      >
        <View className="flex-row items-baseline gap-2">
          <Text className="text-[22px] font-bold text-foreground tabular-nums">
            {done}/{rows.length}
          </Text>
          <Text className="flex-1 text-[13px] text-muted-foreground">
            {done === rows.length ? t`Ready to trade` : t`Before the open`}
          </Text>
          <Icon name="chevron.right" size={12} tintColor={mutedForeground} />
        </View>
        {/* 3% floor so the first tick of the day still reads as a started run. */}
        <Progress
          value={Math.max((done / rows.length) * 100, done > 0 ? 3 : 0)}
          size="sm"
          color={done === rows.length ? 'success' : 'primary'}
        />
        {/* The next open box, so the card answers "what's left" without the
            push. A finished run has nothing left to trail. */}
        {next ? (
          <View className="flex-row items-center gap-2">
            <Icon name="circle" size={16} tintColor={mutedForeground} />
            <Text className="flex-1 text-[14px] text-muted-foreground" numberOfLines={1}>
              {next.text}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </DashboardCard>
  );
}
