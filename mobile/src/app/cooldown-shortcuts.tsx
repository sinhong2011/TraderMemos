import { useRouter } from 'expo-router';
import { Linking, Platform, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';

import { FormFootnote, FormScrollArea } from '@/components/form-sheet';
import { GlassButton, GlassIconButton } from '@/components/glass-button';
import { Icon } from '@/components/icon';
import { t } from '@lingui/core/macro';

/**
 * How to make the cooldown reach the broker app — the one thing this app
 * cannot lock by itself. iOS Shortcuts can run an automation when another
 * app opens; with the two App Intents in `targets/app-intents` ("Am I
 * Cooling Down?" and "Open Cooldown") that automation puts the cooldown
 * screen in front of the broker whenever a session is open. No Screen Time
 * entitlement, nothing to approve — the user builds it once in Shortcuts.
 *
 * Reached from the cooldown start face. iOS only: Android has no Shortcuts.
 */
export default function CooldownShortcutsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [primary, mutedForeground] = useCSSVariable([
    '--color-primary',
    '--color-muted-foreground',
  ]) as [string, string];

  const steps: { title: string; detail: string }[] = [
    {
      title: t`Open Shortcuts → Automation`,
      detail: t`Tap + and choose “App”. Pick your broker app and “Is Opened”, then “Run Immediately”.`,
    },
    {
      title: t`Add “Am I Cooling Down?”`,
      detail: t`Search for TraderMemos in the actions list. It answers Yes while a cooldown is locking trade entry.`,
    },
    {
      title: t`Add an “If” on the result`,
      detail: t`If the answer is Yes, add TraderMemos → “Open Cooldown”. Leave “Otherwise” empty so a normal day opens the broker as usual.`,
    },
    {
      title: t`Done`,
      detail: t`Opening the broker during a cooldown now lands on the cooldown screen. The return gate still has to be answered before the lock lifts.`,
    },
  ];

  return (
    <View
      className="flex-1 bg-background"
      style={{ paddingTop: Platform.OS === 'ios' ? 0 : insets.top }}
    >
      <View className="flex-row items-center gap-3 px-4 pb-2 pt-4">
        <GlassIconButton systemImage="chevron.down" label={t`Close`} onPress={() => router.back()} />
        <Text className="flex-1 text-center text-[15px] font-semibold text-foreground" numberOfLines={1}>
          {t`Lock the broker too`}
        </Text>
        <View className="w-10" />
      </View>
      <FormScrollArea>
        <View className="items-center gap-3 pb-2 pt-2">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <Icon name="lock.shield" size={34} tintColor={primary} />
          </View>
          <Text className="text-center text-[24px] font-bold text-foreground">
            {t`Make the cooldown reach your broker`}
          </Text>
          <FormFootnote>
            {t`TraderMemos can lock its own trade form, not another app. A Shortcuts automation closes that gap: whenever your broker app opens during a cooldown, the cooldown screen opens on top of it.`}
          </FormFootnote>
        </View>
        <View className="gap-3">
          {steps.map((step, index) => (
            <View key={step.title} className="flex-row gap-3 rounded-3xl bg-muted px-4 py-3">
              <View className="h-7 w-7 items-center justify-center rounded-full bg-primary/15">
                <Text className="text-[13px] font-semibold text-primary tabular-nums">{index + 1}</Text>
              </View>
              <View className="flex-1 gap-1">
                <Text className="text-[16px] font-semibold text-foreground">{step.title}</Text>
                <Text className="text-[14px] leading-5 text-muted-foreground">{step.detail}</Text>
              </View>
            </View>
          ))}
        </View>
        <View className="flex-row items-center gap-2 px-1">
          <Icon name="info.circle" size={14} tintColor={mutedForeground} />
          <Text className="flex-1 text-[13px] text-muted-foreground">
            {t`The answer comes from the widget snapshot this app keeps, so it works even when TraderMemos is not running.`}
          </Text>
        </View>
        {Platform.OS === 'ios' ? (
          <View className="items-center pt-2">
            <GlassButton
              label={t`Open Shortcuts`}
              systemImage="arrow.up.forward.app"
              onPress={() => void Linking.openURL('shortcuts://')}
            />
          </View>
        ) : null}
      </FormScrollArea>
    </View>
  );
}
