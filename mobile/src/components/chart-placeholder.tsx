import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Icon } from '@/components/icon';
import { t } from '@lingui/core/macro';

/**
 * Stands in for a Swift Charts plot on platforms that have none.
 *
 * `Chart` is the one `@expo/ui` component with no Compose implementation *and*
 * no universal fallback — Android registers no `ChartView` at all — and the
 * project carries no charting or SVG dependency to draw one by hand. Adding one
 * (react-native-svg, Skia, Victory) is a real dependency decision, not
 * something to smuggle in behind a port, so the cards keep every number they
 * show and say plainly that the plot is missing.
 *
 * Deliberately not an `EmptyState`: nothing is empty here. The data loaded, the
 * headline figures above are real, and only the drawing is absent — saying "no
 * data" would be a lie about the account.
 */
export function ChartPlaceholder({ style }: { style?: StyleProp<ViewStyle> }) {
  const { theme } = useUnistyles();

  return (
    <View style={[styles.root, style]}>
      <Icon name="chart.xyaxis.line" size={24} tintColor={theme.colors.mutedForeground} />
      <Text style={styles.label}>{t`Charts aren't on Android yet`}</Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.fill,
  },
  label: { fontSize: 13, color: theme.colors.mutedForeground },
}));
