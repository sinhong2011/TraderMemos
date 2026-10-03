import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Spinner, cn } from 'panelui-native';
import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Platform, Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';

import { useAccounts, useActiveCooldown, useBreakdown, useSetups } from '@/api/hooks';
import type { Cooldown, CooldownImpulse, CooldownReturnRule, CooldownTrigger } from '@/api/types';
import { ChipGroup } from '@/components/chips';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { FormField, FormFootnote, FormInput, FormScrollArea } from '@/components/form-sheet';
import { GlassButton, GlassIconButton } from '@/components/glass-button';
import { Icon } from '@/components/icon';
import { t } from '@lingui/core/macro';
import { useSelectedAccountId } from '@/lib/account-store';
import {
  COOLDOWN_DURATIONS,
  DEFAULT_COOLDOWN_MINUTES,
  EXTEND_MINUTES,
  IMPULSES,
  MIN_REFLECTION,
  RETURN_RULES,
  formatCountdown,
  triggerLabel,
  triggerSentence,
  useCooldownActions,
  useCooldownClock,
  useCooldownEnabled,
} from '@/lib/cooldown';
import { errorMessage } from '@/lib/errors';
import { useFormatters } from '@/lib/format';
import { notify, tick } from '@/lib/haptics';
import { useMoneyFx } from '@/lib/money';
import { accountBaseCurrency } from '@/lib/prefs';

/**
 * Cooldown mode — three faces on one route.
 *
 * - **Start**: pick how long and (optionally) name the urge; opened by hand
 *   from the tools menu or the Trades "+", or by a push that says a rule
 *   tripped (`?suggest=loss_streak`).
 * - **Counting**: the breathing circle and the clock. The trade form is
 *   locked; the journal is not. "+5 min" extends; "I need to trade now" goes
 *   to the gate early.
 * - **Gate**: the three answers that unlock — the impulse, the one setup
 *   allowed back in, and the rule for the rest of the day. An early unlock
 *   also needs a written reflection; the typing is the friction.
 *
 * One route rather than three because the server owns the state: whichever
 * face the session is in is the one that renders, on every device.
 */
export default function CooldownScreen() {
  const router = useRouter();
  const { suggest } = useLocalSearchParams<{ suggest?: string }>();
  const enabled = useCooldownEnabled();
  const active = useActiveCooldown();
  const session = active.data?.session ?? null;
  const clock = useCooldownClock(session);
  // "I need to trade now" flips the counting face to the gate while the
  // clock still runs; a new session starts back on the clock.
  const [earlyGateFor, setEarlyGateFor] = useState<string | null>(null);
  const earlyGate = session != null && earlyGateFor === session.id;

  // Reached by a deep link (a push, a widget) while the feature is off.
  if (!enabled) {
    return (
      <Shell title={t`Cooldown`} onClose={() => router.back()}>
        <View className="flex-1 items-center justify-center px-6">
          <EmptyState
            title={t`Cooldown mode is off`}
            systemImage="wind"
            description={t`Turn it on in Settings → Risk rules to pause before your next trade.`}
          />
          <GlassButton
            label={t`Open risk rules`}
            systemImage="shield.lefthalf.filled"
            onPress={() => router.push('/(tabs)/(settings)/risk-rules')}
          />
        </View>
      </Shell>
    );
  }
  if (active.error && active.data == null) {
    return (
      <Shell title={t`Cooldown`} onClose={() => router.back()}>
        <ErrorState error={active.error} onRetry={() => void active.refetch()} />
      </Shell>
    );
  }
  if (active.data === undefined) {
    return (
      <Shell title={t`Cooldown`} onClose={() => router.back()}>
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      </Shell>
    );
  }
  if (!session) {
    return <StartFace suggest={suggest} onClose={() => router.back()} />;
  }
  if (clock.phase === 'counting' && !earlyGate) {
    return (
      <CountingFace
        session={session}
        remaining={clock.remaining}
        onEarly={() => setEarlyGateFor(session.id)}
        onClose={() => router.back()}
      />
    );
  }
  return (
    <GateFace
      session={session}
      early={clock.phase === 'counting'}
      onBack={earlyGate ? () => setEarlyGateFor(null) : undefined}
      onClose={() => router.back()}
    />
  );
}

/** Modal chrome: a glass close chevron, a centred title, and the face. */
function Shell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="flex-1 bg-background"
      // An iOS modal's detent already clears the status bar; the Android
      // fullscreen modal does not.
      style={{ paddingTop: Platform.OS === 'ios' ? 0 : insets.top }}
    >
      <View className="flex-row items-center gap-3 px-4 pb-2 pt-4">
        <GlassIconButton systemImage="chevron.down" label={t`Close`} onPress={onClose} />
        <Text
          className="flex-1 text-center text-[15px] font-semibold text-foreground"
          numberOfLines={1}
        >
          {title}
        </Text>
        {/* Balances the close button so the title is truly centred. */}
        <View className="w-10" />
      </View>
      {children}
    </View>
  );
}

const TRIGGERS: readonly CooldownTrigger[] = ['loss_streak', 'daily_loss', 'trade_limit'];

function StartFace({ suggest, onClose }: { suggest?: string; onClose: () => void }) {
  const [primary] = useCSSVariable(['--color-primary']) as [string];
  const { start } = useCooldownActions();
  const [minutes, setMinutes] = useState(DEFAULT_COOLDOWN_MINUTES);
  const [impulse, setImpulse] = useState<CooldownImpulse | ''>('');
  const trigger = TRIGGERS.find((tr) => tr === suggest);

  const begin = () => {
    start.mutate(
      { duration_sec: minutes * 60, trigger: trigger ?? 'manual', impulse },
      {
        onSuccess: () => notify('success'),
        onError: (err) => Alert.alert(t`Could not start`, errorMessage(err)),
      },
    );
  };

  return (
    <Shell title={t`Cooldown`} onClose={onClose}>
      <FormScrollArea>
        <View className="items-center gap-3 pb-2 pt-4">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <Icon name="wind" size={34} tintColor={primary} />
          </View>
          <Text className="text-center text-[28px] font-bold text-foreground">
            {t`Take a cooldown`}
          </Text>
          <Text className="text-center text-[15px] leading-[21px] text-muted-foreground">
            {t`Step away before the next trade decides for you. The trade form stays locked until you answer the return gate.`}
          </Text>
        </View>
        {trigger ? (
          <View className="flex-row items-center gap-3 rounded-3xl bg-muted px-4 py-3">
            <Icon name="exclamationmark.triangle.fill" size={16} tintColor={primary} />
            <Text className="flex-1 text-[14px] text-foreground">
              {t`Your ${triggerLabel(trigger)} rule just tripped.`}
            </Text>
          </View>
        ) : null}
        <FormField label={t`How long?`}>
          <ChipGroup
            options={COOLDOWN_DURATIONS.map((m) => ({ value: String(m), label: t`${m} min` }))}
            selected={[String(minutes)]}
            onToggle={(v) => {
              tick();
              setMinutes(Number(v));
            }}
            select="single"
          />
        </FormField>
        <FormField label={t`What's pulling you in?`}>
          <ChipGroup
            options={IMPULSES.map((i) => ({ value: i.value, label: i.label() }))}
            selected={impulse ? [impulse] : []}
            onToggle={(v) => setImpulse(v === impulse ? '' : (v as CooldownImpulse))}
            tone="neg"
            select="single"
          />
        </FormField>
        <Button
          size="md"
          className="rounded-3xl"
          fullWidth
          loading={start.isPending}
          onPress={begin}
          accessibilityLabel={t`Start ${minutes} min`}
        >
          {t`Start ${minutes} min`}
        </Button>
      </FormScrollArea>
    </Shell>
  );
}

/** 4 s in, 2 s hold, 6 s out — the reference protocol's breath. */
const BREATH = { inMs: 4000, holdMs: 2000, outMs: 6000, scale: 1.32 } as const;
const BREATH_CYCLE = BREATH.inMs + BREATH.holdMs + BREATH.outMs;

function BreathingCircle() {
  const scale = useSharedValue(1);
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in');

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(BREATH.scale, {
          duration: BREATH.inMs,
          easing: Easing.inOut(Easing.sin),
          reduceMotion: ReduceMotion.System,
        }),
        withTiming(BREATH.scale, { duration: BREATH.holdMs, reduceMotion: ReduceMotion.System }),
        withTiming(1, {
          duration: BREATH.outMs,
          easing: Easing.inOut(Easing.sin),
          reduceMotion: ReduceMotion.System,
        }),
      ),
      -1,
      false,
    );
  }, [scale]);

  // The word inside the circle follows the same clock as the scale; a
  // quarter-second poll keeps the label within a beat of the motion.
  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => {
      const elapsed = (Date.now() - started) % BREATH_CYCLE;
      setPhase(elapsed < BREATH.inMs ? 'in' : elapsed < BREATH.inMs + BREATH.holdMs ? 'hold' : 'out');
    }, 250);
    return () => clearInterval(id);
  }, []);

  // A tick at each turn of the breath, so eyes-closed still works.
  useEffect(() => {
    tick();
  }, [phase]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <View className="h-[240px] w-[240px] items-center justify-center">
      <Animated.View className="absolute h-[180px] w-[180px] rounded-full bg-primary/20" style={style} />
      <View className="h-[120px] w-[120px] items-center justify-center rounded-full bg-primary/25">
        <Text className="text-[17px] font-semibold text-foreground">
          {phase === 'in' ? t`Breathe in` : phase === 'hold' ? t`Hold` : t`Breathe out`}
        </Text>
      </View>
    </View>
  );
}

/**
 * One line from the trader's own journal: the mistake tag that costs the
 * most, so the pause is argued with their numbers rather than a quote.
 */
function LossInsight() {
  const [mutedForeground] = useCSSVariable(['--color-muted-foreground']) as [string];
  const { formatPnl } = useFormatters();
  const accounts = useAccounts();
  const selectedAccountId = useSelectedAccountId();
  const baseCurrency = accountBaseCurrency(accounts.data, selectedAccountId);
  const fx = useMoneyFx(baseCurrency);
  const mistakes = useBreakdown('mistake', selectedAccountId ? { account_id: selectedAccountId } : {});

  // "(none)" is the server's bucket for untagged trades — not a mistake.
  const worst = (mistakes.data ?? [])
    .filter((g) => g.key !== '(none)' && g.summary.total_trades >= 3 && g.summary.expectancy < 0)
    .sort((a, b) => a.summary.expectancy - b.summary.expectancy)[0];

  const line = worst
    ? t`Your ${worst.summary.total_trades} “${worst.key}” trades average ${formatPnl(worst.summary.expectancy * (fx.rate ?? 1), fx.currency)} each.`
    : t`The next trade doesn't have to fix the last one.`;

  return (
    <View className="flex-row items-center gap-3 rounded-3xl bg-muted px-4 py-3">
      <Icon name="quote.opening" size={15} tintColor={mutedForeground} />
      <Text className="flex-1 text-[14px] leading-5 text-foreground">{line}</Text>
    </View>
  );
}

function CountingFace({
  session,
  remaining,
  onEarly,
  onClose,
}: {
  session: Cooldown;
  remaining: number;
  onEarly: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { extend } = useCooldownActions();

  return (
    <Shell title={t`Cooling down`} onClose={onClose}>
      <View className="flex-1 items-center justify-center gap-5 px-6">
        <BreathingCircle />
        <Text
          className="text-[56px] font-bold tabular-nums text-foreground"
          accessibilityLabel={t`${formatCountdown(remaining)} remaining`}
        >
          {formatCountdown(remaining)}
        </Text>
        <Text className="text-center text-[15px] text-muted-foreground">
          {triggerSentence(session.trigger)}
        </Text>
        <LossInsight />
      </View>
      <View className="items-center gap-4 px-6" style={{ paddingBottom: insets.bottom + 16 }}>
        <GlassButton
          label={extend.isPending ? t`Adding…` : t`+${EXTEND_MINUTES} min`}
          disabled={extend.isPending}
          onPress={() =>
            extend.mutate(
              { id: session.id, minutes: EXTEND_MINUTES },
              {
                onSuccess: () => tick(),
                onError: (err) => Alert.alert(t`Could not extend`, errorMessage(err)),
              },
            )
          }
        />
        <Pressable
          onPress={onEarly}
          hitSlop={8}
          accessibilityRole="button"
          className="py-2 active:opacity-60"
        >
          <Text className="text-[15px] font-medium text-destructive">{t`I need to trade now`}</Text>
        </Pressable>
      </View>
    </Shell>
  );
}

function GateFace({
  session,
  early,
  onBack,
  onClose,
}: {
  session: Cooldown;
  early: boolean;
  /** Set while the clock still runs: the chevron returns to it. */
  onBack?: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [primary, mutedForeground] = useCSSVariable([
    '--color-primary',
    '--color-muted-foreground',
  ]) as [string, string];
  const { release } = useCooldownActions();
  const setups = useSetups();
  const [impulse, setImpulse] = useState<CooldownImpulse | ''>(session.impulse);
  const [setupId, setSetupId] = useState<string>('');
  const [rule, setRule] = useState<CooldownReturnRule>('none');
  const [reflection, setReflection] = useState('');

  const reflectionLength = reflection.trim().length;
  const ready = impulse !== '' && (!early || reflectionLength >= MIN_REFLECTION);

  const unlock = () => {
    release.mutate(
      {
        id: session.id,
        body: { impulse, setup_id: setupId || null, return_rule: rule, reflection: reflection.trim() },
      },
      {
        onSuccess: () => {
          notify('success');
          router.back();
        },
        onError: (err) => Alert.alert(t`Could not unlock`, errorMessage(err)),
      },
    );
  };

  const setupOptions = [
    { value: '', label: t`Any setup` },
    ...(setups.data ?? []).map((s) => ({ value: s.id, label: s.name })),
  ];

  return (
    <Shell title={t`Before you go back`} onClose={onBack ?? onClose}>
      <FormScrollArea>
        <FormFootnote>
          {early
            ? t`Unlocking early is allowed — but write down why first. The typing is the point.`
            : t`The timer is done. Three honest answers and you're back.`}
        </FormFootnote>
        <FormField label={t`What was pulling you in?`}>
          <ChipGroup
            options={IMPULSES.map((i) => ({ value: i.value, label: i.label() }))}
            selected={impulse ? [impulse] : []}
            onToggle={(v) => setImpulse(v === impulse ? '' : (v as CooldownImpulse))}
            tone="neg"
            select="single"
          />
        </FormField>
        <FormField label={t`The one setup you're allowed`}>
          <ChipGroup
            options={setupOptions}
            selected={[setupId]}
            onToggle={(v) => setSetupId(v)}
            select="single"
          />
          {setups.data && setups.data.length === 0 ? (
            <Text className="text-[13px] text-muted-foreground">
              {t`No playbook setups yet — add some and the gate will hold you to one.`}
            </Text>
          ) : null}
        </FormField>
        <FormField label={t`Your rule for the rest of today`}>
          <View className="gap-1">
            {RETURN_RULES.map((option) => {
              const selected = option.value === rule;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    tick();
                    setRule(option.value);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, checked: selected }}
                  className="min-h-[52px] flex-row items-center gap-3 rounded-3xl bg-muted px-4 py-2 active:opacity-70"
                >
                  <View className="flex-1 gap-0.5">
                    <Text
                      className={
                        selected
                          ? 'text-[16px] font-semibold text-foreground'
                          : 'text-[16px] text-foreground'
                      }
                    >
                      {option.label()}
                    </Text>
                    <Text className="text-[13px] text-muted-foreground">{option.detail()}</Text>
                  </View>
                  <Icon
                    name={selected ? 'checkmark.circle.fill' : 'circle'}
                    size={20}
                    tintColor={selected ? primary : mutedForeground}
                  />
                </Pressable>
              );
            })}
          </View>
        </FormField>
        {early ? (
          <FormField label={t`Why now?`}>
            <FormInput
              value={reflection}
              onChangeText={setReflection}
              placeholder={t`What will be different about this trade?`}
              multiline
              accessibilityLabel={t`Reflection`}
            />
            <Text className="text-right text-[12px] tabular-nums text-muted-foreground">
              {reflectionLength}/{MIN_REFLECTION}
            </Text>
          </FormField>
        ) : null}
        <Button
          size="md"
          // PanelUI's disabled state barely dims on Android; the fade makes
          // the missing answer legible before the tap does nothing.
          className={cn('rounded-3xl', !ready && 'opacity-40')}
          fullWidth
          disabled={!ready}
          loading={release.isPending}
          onPress={unlock}
          accessibilityLabel={t`Unlock`}
        >
          {t`Unlock`}
        </Button>
      </FormScrollArea>
    </Shell>
  );
}
