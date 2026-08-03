import type { StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';
import { useEffect } from 'react';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';

/**
 * Animated placeholder for data-fetch loading states (cards, list rows,
 * boards) — a muted block pulsing between half and full opacity. Spinners
 * stay reserved for action feedback (form submits, sign-in).
 */
export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const pulse = useSharedValue(0.55);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, {
        duration: 700,
        easing: Easing.inOut(Easing.quad),
        reduceMotion: ReduceMotion.System,
      }),
      -1,
      true,
    );
  }, [pulse]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return <Animated.View style={[styles.block, style, animatedStyle]} />;
}

/** Placeholder for a creation form still fetching its prefill data. */
export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <View style={styles.form}>
      {Array.from({ length: fields }, (_, i) => (
        <View key={i} style={styles.field}>
          <Skeleton style={styles.fieldLabel} />
          <Skeleton style={styles.fieldInput} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  block: {
    backgroundColor: theme.colors.muted,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
  },
  form: { padding: theme.spacing.lg, gap: theme.spacing.lg },
  field: { gap: theme.spacing.sm },
  fieldLabel: { width: 90, height: 14 },
  fieldInput: { height: 50, borderRadius: theme.radius.lg + 2 },
}));
