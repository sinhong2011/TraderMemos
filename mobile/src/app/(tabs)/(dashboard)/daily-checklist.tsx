import { Stack, useRouter } from 'expo-router';
import { Card, Progress, Skeleton, cn } from 'panelui-native';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { useRoutineHistory } from '@/api/hooks';
import type { RoutineHistory, RoutineStage } from '@/api/types';
import { EmptyState } from '@/components/empty-state';
import { HeaderIconButton } from '@/components/header-icon-button';
import { Icon } from '@/components/icon';
import { t } from '@lingui/core/macro';
import { addDays, historyStart, stageLabel, STAGES } from '@/lib/routines';
import { useChecklistRun } from '@/lib/use-checklist-run';

/**
 * Today's routine, tickable in place, with the last 13 weeks under it — the
 * run the Home card summarizes. Mounted in both the Home and Settings stacks
 * (the Settings file re-exports this one), so back lands wherever the run was
 * opened from. The pencil up top edits the items; this screen only works
 * through them.
 */
export default function DailyChecklistScreen() {
  // Icon tints are JS values, so they come from the tokens rather than a class.
  const [profit, mutedForeground] = useCSSVariable([
    '--color-profit',
    '--color-muted-foreground',
  ]) as [string, string];
  const router = useRouter();
  const { today, rows, done, hasTemplate, offDay, loading, toggle } = useChecklistRun();
  const history = useRoutineHistory(historyStart(today), today);

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <HeaderIconButton
              systemImage="pencil"
              label={t`Edit routine`}
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
        {loading ? (
          <Skeleton className="h-[220px] rounded-lg" />
        ) : !hasTemplate ? (
          <View className="min-h-[320px]">
            <EmptyState
              title={t`No routine yet`}
              systemImage="checkmark.circle"
              description={t`Tap the pencil to add what you do before, during and after a session.`}
            />
          </View>
        ) : offDay ? (
          <Card className="gap-1 rounded-lg border-0 p-4">
            <Text className="text-[15px] font-semibold text-foreground">{t`Nothing scheduled today`}</Text>
            <Text className="text-[13px] text-muted-foreground">
              {t`Every item is set for other days.`}
            </Text>
          </Card>
        ) : (
          <Card className="gap-3 rounded-lg border-0 p-4">
            <View className="flex-row items-baseline gap-2">
              <Text className="text-[22px] font-bold text-foreground tabular-nums">
                {done}/{rows.length}
              </Text>
              <Text className="text-[13px] text-muted-foreground">
                {done === rows.length ? t`All done` : t`Still to do: ${rows.length - done}`}
              </Text>
            </View>
            {/* 3% floor so the first tick of the day still reads as a started
                run. */}
            <Progress
              value={Math.max((done / rows.length) * 100, done > 0 ? 3 : 0)}
              size="sm"
              color={done === rows.length ? 'success' : 'primary'}
            />
            {STAGES.map((stage) => {
              const stageRows = rows.filter((row) => row.stage === stage);
              if (stageRows.length === 0) return null;
              return (
                <View key={stage} className="gap-1">
                  <Text className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {stageLabel(stage)}
                  </Text>
                  {stageRows.map((row) => (
                    <Pressable
                      key={row.id}
                      onPress={() => toggle(row.id, !row.done)}
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
              );
            })}
          </Card>
        )}

        {hasTemplate ? <HistoryCard history={history.data} loading={history.isLoading} today={today} /> : null}
      </ScrollView>
    </>
  );
}

function cellClass(total: number, done: number, future: boolean, isToday: boolean): string {
  if (future) return 'bg-transparent';
  if (total === 0) return 'bg-muted';
  const ratio = done / total;
  // Today is still in progress: an untouched list isn't a missed one yet.
  if (ratio === 0) return isToday ? 'bg-muted-foreground/30' : 'bg-loss/30';
  if (ratio < 0.5) return 'bg-profit/25';
  if (ratio < 1) return 'bg-profit/55';
  return 'bg-profit';
}

const percent = (ratio: number) => `${Math.round(ratio * 100)}%`;

function HistoryCard({
  history,
  loading,
  today,
}: {
  history: RoutineHistory | undefined;
  loading: boolean;
  today: string;
}) {
  if (loading) return <Skeleton className="h-[200px] rounded-lg" />;
  if (!history) return null;
  const byDay = new Map(history.days.map((d) => [d.day, d]));
  const weeks: string[][] = [];
  for (let start = history.from; start <= history.to; start = addDays(start, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(start, i)));
  }
  const stages = STAGES.map((stage: RoutineStage) => ({ stage, tally: history.by_stage[stage] })).filter(
    (s) => s.tally && s.tally.total > 0,
  );

  return (
    <Card className="gap-4 rounded-lg border-0 p-4">
      <Text className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {t`Last 13 weeks`}
      </Text>
      <View className="flex-row flex-wrap gap-x-6 gap-y-3">
        <Stat
          label={t`Completion`}
          value={history.completion_rate == null ? t`No list yet` : percent(history.completion_rate)}
        />
        <Stat label={t`Day streak`} value={String(history.streak)} />
        {stages.map((s) => (
          <Stat key={s.stage} label={stageLabel(s.stage)} value={percent(s.tally.done / s.tally.total)} />
        ))}
      </View>
      <View
        className="flex-row gap-[3px]"
        accessible
        accessibilityLabel={t`Routine history, ${percent(history.completion_rate ?? 0)} complete`}
      >
        {weeks.map((week) => (
          <View key={week[0]} className="gap-[3px]">
            {week.map((day) => {
              const s = byDay.get(day);
              return (
                <View
                  key={day}
                  className={cn('size-[15px] rounded-[3px]', cellClass(s?.total ?? 0, s?.done ?? 0, day > today, day === today))}
                />
              );
            })}
          </View>
        ))}
      </View>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="gap-0.5">
      <Text className="text-[11px] text-muted-foreground">{label}</Text>
      <Text className="text-[17px] font-semibold tabular-nums text-foreground">{value}</Text>
    </View>
  );
}
