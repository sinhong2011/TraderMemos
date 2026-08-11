import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { t } from '@lingui/core/macro';
import { locale } from '@/i18n';
import { useFormatters } from '@/lib/format';

/** Band height — full-magnitude bar height : `BAR_WIDTH` ≥ ~1.4 (96 → 47 : 32 ≈ 1.47). */
export const WEEK_STRIP_HEIGHT = 96;

/** Drawn column width; slots stay `flex: 1` so day labels stay column-aligned. */
const BAR_WIDTH = 32;

/** Cap strip width on iPad / landscape so slots do not grow absurdly. */
const STRIP_MAX_WIDTH = 360;

/** Hairline height for untraded days — sits on the zero line. */
const UNTRADED_HEIGHT = 2;

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
    const untradedColor = theme.colors.border;

    return days.map((key) => {
      const pnl = data[key];
      const hasTrade = pnl != null;
      const value = pnl ?? 0;
      const magnitude =
        hasTrade && value !== 0
          ? Math.max(1, (Math.abs(value) / scale) * (half - 1))
          : UNTRADED_HEIGHT;
      const d = new Date(`${key}T00:00:00Z`);
      const weekday = d.toLocaleDateString(locale, { weekday: 'long', timeZone: 'UTC' });
      const label =
        pnl != null ? t`${weekday}, ${formatPnl(pnl, currency)}` : t`${weekday}, No trades`;
      return {
        key,
        label,
        top:
          !hasTrade || value === 0
            ? half - magnitude / 2
            : value > 0
              ? half - magnitude
              : half,
        height: magnitude,
        color:
          !hasTrade || value === 0
            ? untradedColor
            : value > 0
              ? theme.colors.profit
              : theme.colors.loss,
      };
    });
  }, [currency, data, days, formatPnl, theme.colors, weekMax]);

  return (
    <View style={styles.container}>
      <View style={styles.strip}>
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
        <View style={styles.zeroLine} pointerEvents="none" />
      </View>
      <View style={styles.labelRow}>
        {days.map((key) => {
          const d = new Date(`${key}T00:00:00Z`);
          const weekday = d.toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' });
          const date = d.toLocaleDateString(locale, {
            month: 'numeric',
            day: 'numeric',
            timeZone: 'UTC',
          });
          return (
            <Text key={key} style={styles.dayLabel} numberOfLines={1}>
              {`${weekday} ${date}`}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: STRIP_MAX_WIDTH,
  },
  strip: {
    height: WEEK_STRIP_HEIGHT,
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
  },
  zeroLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: WEEK_STRIP_HEIGHT / 2,
    height: 1,
    backgroundColor: theme.colors.border,
    zIndex: 1,
  },
  columnSlot: { flex: 1 },
  column: {
    position: 'absolute',
    width: BAR_WIDTH,
    left: '50%',
    marginLeft: -BAR_WIDTH / 2,
    borderRadius: 1,
  },
  labelRow: { flexDirection: 'row', marginTop: 2 },
  dayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    color: theme.colors.mutedForeground,
    ...theme.numeric,
  },
  pressed: { opacity: 0.6 },
}));
