import { Stack, useRouter } from 'expo-router';
import { Card, Progress, cn } from 'panelui-native';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { Icon } from '@/components/icon';
import { EmptyState } from '@/components/empty-state';
import { HeaderIconButton } from '@/components/header-icon-button';
import { t } from '@lingui/core/macro';
import { useChecklistRun } from '@/lib/use-checklist-run';

/**
 * Today's checklist, tickable in place — the run the Home card summarizes.
 * Mounted in both the Home and Settings stacks (the Settings file re-exports
 * this one), so back lands wherever the run was opened from. The pencil up
 * top edits the template; this screen only works through it — the bare
 * `/checklist` path resolves to the editor mounted in the same stack.
 */
export default function DailyChecklistScreen() {
  // Icon tints are JS values, so they come from the tokens rather than a class.
  const [profit, mutedForeground] = useCSSVariable([
    '--color-profit',
    '--color-muted-foreground',
  ]) as [string, string];
  const router = useRouter();
  const { rows, done, hasTemplate, toggle } = useChecklistRun();

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <HeaderIconButton
              systemImage="pencil"
              label={t`Edit checklist`}
              onPress={() => router.push('/checklist')}
            />
          ),
        }}
      />
      <ScrollView
        className="flex-1 bg-background"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-4 p-4 pb-12"
      >
        {!hasTemplate ? (
          <View className="min-h-[320px]">
            <EmptyState
              title={t`No items yet`}
              systemImage="checkmark.circle"
              description={t`Tap the pencil to write the routine you clear before you trade.`}
            />
          </View>
        ) : (
          <Card className="gap-3 rounded-lg border-0 p-4">
            <View className="flex-row items-baseline gap-2">
              <Text className="text-[22px] font-bold text-foreground tabular-nums">
                {done}/{rows.length}
              </Text>
              <Text className="text-[13px] text-muted-foreground">
                {done === rows.length ? t`Ready to trade` : t`Before the open`}
              </Text>
            </View>
            {/* 3% floor so the first tick of the day still reads as a started
                run. */}
            <Progress
              value={Math.max((done / rows.length) * 100, done > 0 ? 3 : 0)}
              size="sm"
              color={done === rows.length ? 'success' : 'primary'}
            />
            <View className="gap-1">
              {rows.map((row, index) => (
                <Pressable
                  key={`${index}-${row.text}`}
                  onPress={() => toggle(index, !row.done)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: row.done }}
                  accessibilityLabel={row.text}
                  hitSlop={4}
                  className="flex-row items-center gap-2 py-1 active:opacity-60"
                >
                  <Icon
                    name={row.done ? 'checkmark.circle.fill' : 'circle'}
                    size={20}
                    tintColor={row.done ? profit : mutedForeground}
                  />
                  <Text
                    className={cn(
                      'flex-1 text-[15px] text-foreground',
                      row.done && 'text-muted-foreground line-through',
                    )}
                  >
                    {row.text}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Card>
        )}
      </ScrollView>
    </>
  );
}
