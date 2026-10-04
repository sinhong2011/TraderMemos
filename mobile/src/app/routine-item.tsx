import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { cn } from 'panelui-native';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { queryKeys, useApiRequest, useRoutineItems } from '@/api/hooks';
import type { RoutineBody, RoutineItem, RoutineStage } from '@/api/types';
import { FormField, FormFootnote, FormInput, FormSheet } from '@/components/form-sheet';
import { Segmented } from '@/components/segmented';
import { t } from '@lingui/core/macro';
import { useRoutineToday } from '@/lib/checklist';
import { errorMessage } from '@/lib/errors';
import { MON_TO_FRI, PICKER_DAYS, STAGES, stageLabel, weekdayShort, weekdaysLabel } from '@/lib/routines';

/**
 * New / edit routine item — pushed from the routine editor's rows and its Add
 * buttons (the tag-form shape). A stage or days change applies from today on:
 * the server ends the item today and starts a successor, so past days keep the
 * schedule they actually had.
 */
export default function RoutineItemScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApiRequest();
  // Market clock, like the run: "from today on" means the run's today.
  const { day: today } = useRoutineToday();
  const { id, stage: stageParam } = useLocalSearchParams<{ id?: string; stage?: RoutineStage }>();
  const items = useRoutineItems(today);
  const editing = id ? items.data?.items.find((item) => item.id === id) : undefined;

  const [title, setTitle] = useState(editing?.title ?? '');
  const [stage, setStage] = useState<RoutineStage>(editing?.stage ?? stageParam ?? 'pre');
  const [days, setDays] = useState<number[]>(editing?.weekdays ?? MON_TO_FRI);

  const save = useMutation({
    mutationFn: (body: RoutineBody) =>
      id
        ? api<RoutineItem>(`/routines/${id}`, { method: 'PATCH', body })
        : api<RoutineItem>('/routines', { method: 'POST', body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.routines() });
      router.back();
    },
    onError: (err) => Alert.alert(t`Could not save`, errorMessage(err)),
  });

  const trimmed = title.trim();

  function toggleDay(day: number) {
    setDays((cur) =>
      cur.includes(day)
        ? cur.length === 1
          ? cur // the last day stays on: a routine with no days never appears
          : cur.filter((d) => d !== day)
        : [...cur, day].sort((a, b) => a - b),
    );
  }

  function handleSave() {
    if (!trimmed) return;
    save.mutate({ title: trimmed, stage, weekdays: days, day: today });
  }

  return (
    <FormSheet
      pushed
      title={id ? t`Edit item` : t`New item`}
      saving={save.isPending}
      saveDisabled={!trimmed}
      onSave={handleSave}
    >
      <FormFootnote>
        {id
          ? t`Changing the stage or days applies from today; past days keep what they were.`
          : t`Something you do every session, ticked off on Home.`}
      </FormFootnote>
      <FormField quiet label={t`Item`}>
        <FormInput
          value={title}
          onChangeText={setTitle}
          placeholder={t`e.g. Mark key levels`}
          returnKeyType="done"
          onSubmitEditing={handleSave}
        />
      </FormField>
      <FormField quiet label={t`When`}>
        <Segmented
          fill
          options={STAGES.map((value) => ({ value, label: stageLabel(value) }))}
          value={stage}
          onChange={setStage}
        />
      </FormField>
      <FormField quiet label={t`Days`}>
        <View className="gap-2">
          <View className="flex-row gap-1.5">
            {PICKER_DAYS.map((day) => {
              const on = days.includes(day);
              return (
                <Pressable
                  key={day}
                  onPress={() => toggleDay(day)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={weekdayShort(day)}
                  className={cn(
                    'h-10 flex-1 items-center justify-center rounded-lg active:opacity-70',
                    on ? 'bg-primary' : 'bg-muted',
                  )}
                >
                  <Text
                    className={cn(
                      'text-[13px] font-semibold',
                      on ? 'text-primary-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {weekdayShort(day).slice(0, 2)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text className="text-[13px] text-muted-foreground">{weekdaysLabel(days)}</Text>
        </View>
      </FormField>
    </FormSheet>
  );
}
