import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { t } from '@lingui/core/macro';
import { locale } from '@/i18n';
import { useFormatters } from '@/lib/format';

/** Compact band height — same order of magnitude as `equity-strip`'s `STRIP_HEIGHT`. */
export const WEEK_STRIP_HEIGHT = 56;

/**
 * One column per weekday above/below a centre zero line — the week-mode
 * counterpart to `equity-strip` and `chart-canvas`: plain Views, no SVG.
 * Profit rises, loss falls; untraded days read as a hairline on the zero line.
 */
export function WeekPnlStrip({
  days,
  data,
  weekMax,
  onSelect,
  currency,
}: {
  days: string[];
  data: Record<string, number>;
  weekMax: number;
  onSelect: (date: string) => void;
  currency: string;
}) {
  const { theme } = useUnistyles();
  const { formatPnl } = useFormatters();

  const columns = useMemo(() => {
    const scale = weekMax > 0 ? weekMax : 1;
    const half = WEEK_STRIP_HEIGHT / 2;

    return days.map((key) => {
      const pnl = data[key];
      const hasTrade = pnl != null;
      const value = pnl ?? 0;
      const magnitude =
        hasTrade && value !== 0
          ? Math.max(1, (Math.abs(value) / scale) * (half - 1))
          : 1;
      const d = new Date(`${key}T00:00:00Z`);
      const weekday = d.toLocaleDateString(locale, { weekday: 'long', timeZone: 'UTC' });
      const label =
        pnl != null ? t`${weekday}, ${formatPnl(pnl, currency)}` : t`${weekday}, No trades`;
      return {
        key,
        label,
        top: !hasTrade || value === 0 ? half - 0.5 : value > 0 ? half - magnitude : half,
        height: magnitude,
        color:
          !hasTrade || value === 0
            ? theme.colors.flat
            : value > 0
              ? theme.colors.profit
              : theme.colors.loss,
      };
    });
  }, [currency, data, days, formatPnl, theme.colors, weekMax]);

  return (
    <View style={styles.strip}>
      <View style={styles.zeroLine} />
      {columns.map((column) => (
        <Pressable
          key={column.key}
          onPress={() => onSelect(column.key)}
          accessibilityRole="button"
          accessibilityLabel={column.label}
          style={({ pressed }) => [styles.columnSlot, pressed && styles.pressed]}
        >
          <View
            style={[
              styles.column,
              { top: column.top, height: column.height, backgroundColor: column.color },
            ]}
          />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  strip: {
    height: WEEK_STRIP_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  zeroLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: WEEK_STRIP_HEIGHT / 2,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  columnSlot: { flex: 1 },
  column: { flex: 1, marginHorizontal: 0.5, borderRadius: 1 },
  pressed: { opacity: 0.6 },
}));
