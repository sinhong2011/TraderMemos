import { type SFSymbol } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

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
import { pnlColor } from '@/styles/unistyles';

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
  const { theme } = useUnistyles();
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
      style={({ pressed }) => [
        styles.transportButton,
        primary && styles.transportPrimary,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Icon
        name={icon}
        size={primary ? 20 : 15}
        tintColor={primary ? theme.colors.background : theme.colors.foreground}
      />
    </Pressable>
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.readout}>
        <View style={styles.readoutMain}>
          {showPnl ? (
            <>
              <Text
                style={[styles.net, { color: pnlColor(theme.colors, frame?.net) }]}
                numberOfLines={1}
              >
                {formatPnl(frame?.net ?? 0, currency)}
              </Text>
              {frame?.rMultiple != null ? (
                <Text style={[styles.rMultiple, { color: pnlColor(theme.colors, frame.net) }]}>
                  {`${frame.rMultiple >= 0 ? '+' : ''}${frame.rMultiple.toFixed(2)}R`}
                </Text>
              ) : null}
            </>
          ) : (
            <Text style={[styles.net, styles.price]} numberOfLines={1}>
              {formatCurrency(frame?.close ?? 0, currency)}
            </Text>
          )}
        </View>
        <View style={styles.readoutMeta}>
          {showPnl ? (
            <Text style={styles.metaStrong}>
              {frame ? stateLabel(frame.state, frame.position) : t`Flat`}
            </Text>
          ) : null}
          <Text style={styles.meta}>{barTimeLabel}</Text>
        </View>
      </View>

      <EquityStrip frames={run.frames} cursor={controller.cursor} onScrub={controller.seek} />

      {/* Run MAE/MFE — what the trade was worth at its best and worst, which is
          the pair a review is actually looking for. */}
      {showPnl ? (
        <View style={styles.extremes}>
          <Text style={styles.meta}>
            {t`Peak`}{' '}
            <Text style={[styles.metaValue, { color: theme.colors.profit }]}>
              {formatCurrency(run.best, currency)}
            </Text>
          </Text>
          <Text style={styles.meta}>
            {t`Trough`}{' '}
            <Text style={[styles.metaValue, { color: theme.colors.loss }]}>
              {formatCurrency(run.worst, currency)}
            </Text>
          </Text>
          {frame && frame.fillCount > 0 ? (
            <Text style={styles.meta}>{t`${frame.fillCount} fills`}</Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.transport}>
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
          style={({ pressed }) => [styles.transportButton, pressed && styles.pressed]}
        >
          <Text style={styles.speedLabel}>{speedLabel(controller.speed)}</Text>
        </Pressable>
      </View>

      {run.mismatch && showPnl ? (
        <Text style={styles.footnote}>
          {t`Fill prices disagree with the tape — in-flight P&L is marked to the chart and may look off. The closing figure comes from the fills.`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  wrap: { gap: theme.spacing.md },
  readout: { flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.md },
  readoutMain: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing.sm },
  net: { fontSize: 28, fontWeight: '700', ...theme.numeric },
  price: { color: theme.colors.foreground },
  rMultiple: { fontSize: 15, fontWeight: '600', ...theme.numeric },
  readoutMeta: { alignItems: 'flex-end', gap: 2 },
  metaStrong: { fontSize: 13, fontWeight: '600', color: theme.colors.foreground, ...theme.numeric },
  meta: { fontSize: 12, color: theme.colors.mutedForeground, ...theme.numeric },
  metaValue: { fontWeight: '600' },
  extremes: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.lg },
  // Evenly spaced rather than left-packed: five equal-weight targets, with the
  // play button's extra 12pt of diameter doing the ranking.
  transport: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.lg,
  },
  transportButton: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.muted,
  },
  // The one control worth aiming at without looking — inverted and larger.
  transportPrimary: { width: 52, height: 52, backgroundColor: theme.colors.foreground },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.6 },
  speedLabel: { fontSize: 14, fontWeight: '700', color: theme.colors.foreground, ...theme.numeric },
  footnote: { fontSize: 12, color: theme.colors.mutedForeground },
}));
