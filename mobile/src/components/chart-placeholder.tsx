import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { Icon } from '@/components/icon';
import { t } from '@lingui/core/macro';

/**
 * Stands in for a plot a card cannot draw.
 *
 * Vestigial since the charts moved to PanelUI: those are JS-drawn and render
 * identically on both platforms, so nothing in this batch needs a fallback any
 * more. Kept because `breakdown-card` still reaches for it, and because it is
 * the right shape for "the numbers are real, only the drawing is missing".
 *
 * Deliberately not an `EmptyState`: nothing is empty here. The data loaded, the
 * headline figures above are real, and only the drawing is absent — saying "no
 * data" would be a lie about the account.
 */
export function ChartPlaceholder({ style }: { style?: StyleProp<ViewStyle> }) {
  const [mutedForeground] = useCSSVariable(['--color-muted-foreground']) as [string];

  return (
    <View className="items-center justify-center gap-2 rounded-md bg-fill" style={style}>
      <Icon name="chart.xyaxis.line" size={24} tintColor={mutedForeground} />
      <Text className="text-[13px] text-muted-foreground">{t`Charts aren't on Android yet`}</Text>
    </View>
  );
}
