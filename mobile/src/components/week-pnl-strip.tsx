import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { t } from '@lingui/core/macro';
import { locale } from '@/i18n';
import { useFormatters } from '@/lib/format';
import { usePnlPalette } from '@/styles/pnl';

/** Band height — full-magnitude bar height : `BAR_WIDTH` ≥ ~1.4 (96 → 47 : 32 ≈ 1.47). */
export const WEEK_STRIP_HEIGHT = 88;

/** Gap between bars and weekday labels — 4% of band height, scales with `WEEK_STRIP_HEIGHT`. */
const LABEL_GAP_RATIO = 0.04;
const LABEL_GAP = Math.round(WEEK_STRIP_HEIGHT * LABEL_GAP_RATIO);

/** Drawn column width; slots stay `flex: 1` so day labels stay column-aligned. */
const BAR_WIDTH = 32;

/** Cap strip width on iPad / landscape so slots do not grow absurdly. */
const STRIP_MAX_WIDTH = 360;

/** Hairline height for untraded days — sits on the zero line. */
const UNTRADED_HEIGHT = 2;

/** One px above/below the zero line so bars do not kiss the axis. */
const ZERO_PAD = 1;

type StripLayout = {
  profitHalf: number;
  lossHalf: number;
  zeroLineY: number;
  pxPerUnit: number;
};

/**
 * Size the above/below-zero bands from the week's extrema so one-sided weeks
 * do not reserve empty half-height. Profit and loss share one scale: equal |P&L|
 * yields equal bar length; each side's max bar fills its band.
 */
export function computeWeekStripLayout(
  days: string[],
  data: Record<string, number>,
): StripLayout {
  let weekMaxGain = 0;
  let weekMaxLoss = 0;
  for (const key of days) {
    const pnl = data[key];
    if (pnl == null) continue;
    if (pnl > 0) weekMaxGain = Math.max(weekMaxGain, pnl);
    else if (pnl < 0) weekMaxLoss = Math.max(weekMaxLoss, -pnl);
  }

  const drawable = WEEK_STRIP_HEIGHT - ZERO_PAD * 2;

  if (weekMaxGain > 0 && weekMaxLoss > 0) {
    const sum = weekMaxGain + weekMaxLoss;
    const profitHalf = ZERO_PAD + (drawable * weekMaxGain) / sum;
    const lossHalf = ZERO_PAD + (drawable * weekMaxLoss) / sum;
    return {
      profitHalf,
      lossHalf,
      zeroLineY: profitHalf,
      pxPerUnit: drawable / sum,
    };
  }

  if (weekMaxGain > 0) {
    return {
      profitHalf: WEEK_STRIP_HEIGHT,
      lossHalf: 0,
      zeroLineY: WEEK_STRIP_HEIGHT,
      pxPerUnit: drawable / weekMaxGain,
    };
  }

  if (weekMaxLoss > 0) {
    return {
      profitHalf: 0,
      lossHalf: WEEK_STRIP_HEIGHT,
      zeroLineY: 0,
      pxPerUnit: drawable / weekMaxLoss,
    };
  }

  // No trades or every day flat — centre zero line, hairlines only.
  const half = WEEK_STRIP_HEIGHT / 2;
  return { profitHalf: half, lossHalf: half, zeroLineY: half, pxPerUnit: 1 };
}

/**
 * One column per weekday above/below a centre zero line — the week-mode
 * counterpart to `equity-strip` and `chart-canvas`: plain Views, no SVG.
 * Profit rises, loss falls; untraded days read as a hairline on the zero line.
 */
export function WeekPnlStrip({
  days,
  data,
  onSelect,
  currency,
}: {
  days: string[];
  data: Record<string, number>;
  onSelect: (date: string) => void;
  currency: string;
}) {
  // Bars are positioned views, so their fills are token *values*, not classes.
  const palette = usePnlPalette();
  const [border] = useCSSVariable(['--color-border']) as [string];
  const { formatPnl } = useFormatters();

  const { layout, columns } = useMemo(() => {
    const layout = computeWeekStripLayout(days, data);
    const { zeroLineY, pxPerUnit } = layout;

    const columns = days.map((key) => {
      const pnl = data[key];
      const hasTrade = pnl != null;
      const value = pnl ?? 0;
      const magnitude =
        hasTrade && value !== 0
          ? Math.max(1, Math.abs(value) * pxPerUnit)
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
            ? zeroLineY - magnitude / 2
            : value > 0
              ? zeroLineY - magnitude
              : zeroLineY,
        height: magnitude,
        color:
          !hasTrade || value === 0
            ? border
            : value > 0
              ? palette.profit
              : palette.loss,
      };
    });

    return { layout, columns };
  }, [border, currency, data, days, formatPnl, palette.loss, palette.profit]);

  return (
    <View className="w-full self-center" style={{ maxWidth: STRIP_MAX_WIDTH }}>
      <View
        className="flex-row items-stretch overflow-hidden"
        style={{ height: WEEK_STRIP_HEIGHT }}
      >
        {columns.map((column) => (
          <Pressable
            key={column.key}
            onPress={() => onSelect(column.key)}
            accessibilityRole="button"
            accessibilityLabel={column.label}
            className="flex-1 active:opacity-60"
          >
            <View
              className="absolute left-1/2 rounded-[1px]"
              style={{
                width: BAR_WIDTH,
                marginLeft: -BAR_WIDTH / 2,
                top: column.top,
                height: column.height,
                backgroundColor: column.color,
              }}
            />
          </Pressable>
        ))}
        <View
          className="absolute left-0 right-0 z-10 h-px bg-border"
          style={{ top: layout.zeroLineY }}
          pointerEvents="none"
        />
      </View>
      <View className="flex-row" style={{ marginTop: LABEL_GAP }}>
        {days.map((key) => {
          const d = new Date(`${key}T00:00:00Z`);
          const weekday = d.toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' });
          const date = d.toLocaleDateString(locale, {
            month: 'numeric',
            day: 'numeric',
            timeZone: 'UTC',
          });
          return (
            <Text
              key={key}
              className="flex-1 text-center text-[10px] text-muted-foreground tabular-nums"
              numberOfLines={1}
            >
              {`${weekday} ${date}`}
            </Text>
          );
        })}
      </View>
    </View>
  );
}
