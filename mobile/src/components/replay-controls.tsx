import { type SFSymbol } from 'expo-symbols';
import { cn } from 'panelui-native';
import { Pressable, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { Icon } from '@/components/icon';
import { EquityStrip } from '@/components/equity-strip';
import { t } from '@lingui/core/macro';
import { useFormatters } from '@/lib/format';
import * as haptics from '@/lib/haptics';
import {
  REPLAY_SPEEDS,
  type ReplayController,
  type ReplayRun,
  type ReplaySpeed,
  type ReplayState,
} from '@/lib/replay';
import { pnlClass } from '@/styles/pnl';

/** Label for a speed, from the same table the picker used to render. */
function speedLabel(speed: ReplaySpeed): string {
  return REPLAY_SPEEDS.find((option) => option.value === speed)?.label ?? `${speed}×`;
}

function nextSpeed(speed: ReplaySpeed): ReplaySpeed {
  const at = REPLAY_SPEEDS.findIndex((option) => option.value === speed);
  return REPLAY_SPEEDS[(at + 1) % REPLAY_SPEEDS.length].value;
}

function stateLabel(state: ReplayState, position: number): string {
  switch (state) {
    case 'long':
      return t`Long ${position}`;
    case 'short':
      return t`Short ${Math.abs(position)}`;
    case 'closed':
      return t`Closed`;
    case 'flat':
      return t`Flat`;
  }
}

/**
 * The replay's readout and transport, as one block.
 *
 * Order is deliberate: the figure the trade is worth at this bar, then the
 * curve that got it there, then the controls. Reviewing a trade is reading the
 * number and scrubbing back to where it turned — the buttons are the least
 * important row, so they sit at the bottom.
 */
export function ReplayControls({
  controller,
  run,
  currency,
  barTimeLabel,
  mode = 'pnl',
}: {
  controller: ReplayController;
  run: ReplayRun;
  currency: string;
  /** Formatted clock for the cursor bar — the caller owns interval formatting. */
  barTimeLabel: string;
  /**
   * 'price' for a bare symbol replay: there are no fills, so every P&L figure
   * would be a zero pretending to be information. The bar's close leads instead.
   */
  mode?: 'pnl' | 'price';
}) {
  const [foreground, background] = useCSSVariable([
    '--color-foreground',
    '--color-background',
  ]) as [string, string];
  // Formatters bound to the display prefs (see lib/format.ts).
  const { formatCurrency, formatPnl } = useFormatters();
  const frame = run.frames[controller.cursor];
  const lastIndex = Math.max(run.frames.length - 1, 0);
  const showPnl = mode === 'pnl';

  const button = (
    icon: SFSymbol,
    onPress: () => void,
    label: string,
    { primary = false, disabled = false } = {},
  ) => (
    <Pressable
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      className={cn(
        'h-10 w-10 items-center justify-center rounded-full bg-muted active:opacity-60',
        // The one control worth aiming at without looking — inverted and larger.
        primary && 'h-[52px] w-[52px] bg-foreground',
        disabled && 'opacity-35',
      )}
    >
      <Icon name={icon} size={primary ? 20 : 15} tintColor={primary ? background : foreground} />
    </Pressable>
  );

  return (
    <View className="gap-3">
      <View className="flex-row items-end gap-3">
        <View className="flex-1 flex-row items-baseline gap-2">
          {showPnl ? (
            <>
              <Text
                className={cn('text-[28px] font-bold tabular-nums', pnlClass(frame?.net))}
                numberOfLines={1}
              >
                {formatPnl(frame?.net ?? 0, currency)}
              </Text>
              {frame?.rMultiple != null ? (
                <Text
                  className={cn('text-[15px] font-semibold tabular-nums', pnlClass(frame.net))}
                >
                  {`${frame.rMultiple >= 0 ? '+' : ''}${frame.rMultiple.toFixed(2)}R`}
                </Text>
              ) : null}
            </>
          ) : (
            <Text className="text-[28px] font-bold tabular-nums text-foreground" numberOfLines={1}>
              {formatCurrency(frame?.close ?? 0, currency)}
            </Text>
          )}
        </View>
        <View className="items-end gap-0.5">
          {showPnl ? (
            <Text className="text-[13px] font-semibold tabular-nums text-foreground">
              {frame ? stateLabel(frame.state, frame.position) : t`Flat`}
            </Text>
          ) : null}
          <Text className="text-xs tabular-nums text-muted-foreground">{barTimeLabel}</Text>
        </View>
      </View>

      <EquityStrip frames={run.frames} cursor={controller.cursor} onScrub={controller.seek} />

      {/* Run MAE/MFE — what the trade was worth at its best and worst, which is
          the pair a review is actually looking for. */}
      {showPnl ? (
        <View className="flex-row items-center gap-4">
          <Text className="text-xs tabular-nums text-muted-foreground">
            {t`Peak`}{' '}
            <Text className="font-semibold text-profit">{formatCurrency(run.best, currency)}</Text>
          </Text>
          <Text className="text-xs tabular-nums text-muted-foreground">
            {t`Trough`}{' '}
            <Text className="font-semibold text-loss">{formatCurrency(run.worst, currency)}</Text>
          </Text>
          {frame && frame.fillCount > 0 ? (
            <Text className="text-xs tabular-nums text-muted-foreground">{t`${frame.fillCount} fills`}</Text>
          ) : null}
        </View>
      ) : null}

      {/* Evenly spaced rather than left-packed: five equal-weight targets, with
          the play button's extra 12pt of diameter doing the ranking. */}
      <View className="flex-row items-center justify-center gap-4">
        {button('gobackward', controller.restart, t`Restart`)}
        {button('backward.frame.fill', controller.stepBack, t`Step back`, {
          disabled: controller.cursor <= 0,
        })}
        {button(
          controller.playing ? 'pause.fill' : 'play.fill',
          controller.toggle,
          controller.playing ? t`Pause` : t`Play`,
          { primary: true },
        )}
        {button('forward.frame.fill', controller.stepForward, t`Step forward`, {
          disabled: controller.cursor >= lastIndex,
        })}
        {/* A four-segment picker crammed beside four buttons left every target
            too narrow to hit, so speed cycles from one chip instead — the
            podcast-player idiom, and it keeps the transport evenly spaced. */}
        <Pressable
          onPress={() => {
            haptics.tap();
            controller.setSpeed(nextSpeed(controller.speed));
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t`Playback speed`}
          accessibilityValue={{ text: speedLabel(controller.speed) }}
          accessibilityHint={t`Cycles to the next speed`}
          className="h-10 w-10 items-center justify-center rounded-full bg-muted active:opacity-60"
        >
          <Text className="text-sm font-bold tabular-nums text-foreground">
            {speedLabel(controller.speed)}
          </Text>
        </Pressable>
      </View>

      {run.mismatch && showPnl ? (
        <Text className="text-xs text-muted-foreground">
          {t`Fill prices disagree with the tape — in-flight P&L is marked to the chart and may look off. The closing figure comes from the fills.`}
        </Text>
      ) : null}
    </View>
  );
}
