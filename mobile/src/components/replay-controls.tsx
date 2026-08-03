import { Host, Slider } from '@expo/ui/swift-ui';
import { tint } from '@expo/ui/swift-ui/modifiers';
import { SymbolView } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Segmented } from '@/components/segmented';
import { t } from '@lingui/core/macro';
import { REPLAY_SPEEDS, type ReplayController } from '@/lib/replay';

/**
 * Transport row for bar replay: step / play-pause / step, a native scrubber,
 * and the speed picker. The caller renders the readout (P&L pill, bar time)
 * above — this is just the controls.
 */
export function ReplayControls({
  controller,
  barCount,
}: {
  controller: ReplayController;
  barCount: number;
}) {
  const { theme } = useUnistyles();
  const lastIndex = Math.max(barCount - 1, 0);

  const button = (
    icon: string,
    onPress: () => void,
    label: string,
    disabled = false,
  ) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.transportButton,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <SymbolView
        name={icon as 'play.fill'}
        size={15}
        tintColor={theme.colors.foreground}
      />
    </Pressable>
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.transport}>
        {button('backward.frame.fill', controller.stepBack, t`Step back`, controller.cursor <= 0)}
        {button(
          controller.playing ? 'pause.fill' : 'play.fill',
          controller.toggle,
          controller.playing ? t`Pause` : t`Play`,
        )}
        {button(
          'forward.frame.fill',
          controller.stepForward,
          t`Step forward`,
          controller.cursor >= lastIndex,
        )}
        <View style={styles.slider}>
          <Host matchContents>
            <Slider
              value={controller.cursor}
              min={0}
              max={lastIndex}
              step={1}
              onValueChange={(value) => controller.seek(Math.round(value))}
              modifiers={[tint(theme.colors.foreground)]}
            />
          </Host>
        </View>
      </View>
      <View style={styles.footer}>
        <Segmented
          compact
          options={REPLAY_SPEEDS}
          value={controller.speed}
          onChange={controller.setSpeed}
        />
        <Pressable
          onPress={controller.exit}
          hitSlop={8}
          accessibilityRole="button"
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Text style={styles.exit}>{t`Exit replay`}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  wrap: { gap: theme.spacing.sm },
  transport: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  transportButton: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.muted,
  },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.6 },
  slider: { flex: 1 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  exit: { fontSize: 13, fontWeight: '500', color: theme.colors.mutedForeground },
}));
