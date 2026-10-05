import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { useWeeklyFocus } from '@/api/hooks';
import { DashboardCard } from '@/components/dashboard-card';
import { t } from '@lingui/core/macro';

/**
 * This week's focus on Home — the one to three bullets the last weekly review
 * set under "Focus for next week". No ticks: a focus is how you trade this
 * week, not a task; whether it held is answered in the next review.
 *
 * Renders nothing without a focus (ChecklistCard's rule) — writing one belongs
 * in the weekly review, not in a prompt on Home.
 */
export function WeeklyFocusCard() {
  const router = useRouter();
  const focus = useWeeklyFocus();
  const items = focus.data?.items ?? [];
  if (items.length === 0) return null;

  const noteId = focus.data?.note_id;
  return (
    <DashboardCard
      title={t`This week's focus`}
      action={
        noteId
          ? {
              label: t`Review`,
              onPress: () => router.push({ pathname: '/edit-note', params: { id: noteId } }),
            }
          : undefined
      }
    >
      <View className="gap-2.5">
        {items.map((item, i) => (
          <View key={`${i}-${item}`} className="flex-row items-baseline gap-3">
            <Text className="w-4 text-right text-[13px] font-semibold tabular-nums text-muted-foreground">
              {i + 1}
            </Text>
            <Text className="flex-1 text-[15px] font-medium leading-5 text-foreground">{item}</Text>
          </View>
        ))}
      </View>
    </DashboardCard>
  );
}
