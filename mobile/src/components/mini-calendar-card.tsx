import { cn } from 'panelui-native';
import { FitText } from '@/components/fit-text';
import { Text, View } from 'react-native';

import type { DailyPnl } from '@/api/types';
import { DashboardCard } from '@/components/dashboard-card';
import { t } from '@lingui/core/macro';
import { locale } from '@/i18n';
import { monthGrid } from '@/lib/calendar';
import { useFormatters } from '@/lib/format';
import { pnlBgTint, pnlClass, usePnlPalette } from '@/styles/pnl';

/** Sun-first narrow weekday letters in the app locale (avoids S/T msgid collisions). */
const DOW = (() => {
  const fmt = new Intl.DateTimeFormat(locale, { weekday: 'narrow', timeZone: 'UTC' });
  // 2023-01-01 was a Sunday.
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2023, 0, 1 + i))));
})();

/** One day of the grid — shared by the filled cells and the leading blanks. */
const CELL = 'min-h-[42px] flex-1 items-center justify-center gap-px rounded-sm px-px';

/** This-month P&L heatmap, ported from the web dashboard's mini calendar. */
export function MiniCalendarCard({
  year,
  month,
  dailyPnl,
  currency,
  fxRate = 1,
  onOpenCalendar,
}: {
  year: number;
  /** 1-based. */
  month: number;
  dailyPnl: DailyPnl;
  currency: string;
  /** Base→display conversion applied before formatting (1 = account currency). */
  fxRate?: number;
  onOpenCalendar?: () => void;
}) {
  // The cell wash is a computed rgba, so the hues come from the tokens as
  // values rather than as classes.
  const palette = usePnlPalette();
  // Formatters bound to the display prefs (see lib/format.ts).
  const { formatPnlCompact } = useFormatters();
  const grid = monthGrid(year, month, dailyPnl);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return (
    <DashboardCard
      title={t`Month`}
      action={onOpenCalendar ? { label: t`Full calendar`, onPress: onOpenCalendar } : undefined}
    >
      <Text className="text-[15px] font-medium text-foreground">{monthLabel}</Text>

      <View>
        <View className="mb-0.5 flex-row gap-0.5">
          {DOW.map((d, i) => (
            <Text
              key={`${d}-${i}`}
              className="flex-1 py-0.5 text-center text-[10px] font-medium text-muted-foreground"
            >
              {d}
            </Text>
          ))}
        </View>
        {grid.weeks.map((week, wi) => (
          <View key={wi} className="mb-0.5 flex-row gap-0.5">
            {week.map((cell, ci) => {
              if (!cell) return <View key={`empty-${ci}`} className={CELL} />;
              const isToday = cell.date === today;
              const hasPnl = cell.pnl != null;
              return (
                <View
                  key={cell.date}
                  className={cn(CELL, isToday && !hasPnl && 'bg-muted')}
                  style={
                    hasPnl
                      ? { backgroundColor: pnlBgTint(palette, cell.pnl!, grid.maxAbs) }
                      : undefined
                  }
                >
                  <Text
                    className={cn(
                      'text-[11px] text-muted-foreground tabular-nums',
                      isToday && 'font-semibold text-heading',
                    )}
                  >
                    {Number(cell.date.slice(8, 10))}
                  </Text>
                  {hasPnl ? (
                    <FitText
                      className={cn(
                        'text-[9px] font-medium tabular-nums',
                        pnlClass(cell.pnl),
                      )}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.75}
                    >
                      {formatPnlCompact(cell.pnl! * fxRate, currency)}
                    </FitText>
                  ) : null}
                </View>
              );
            })}
          </View>
        ))}
      </View>

      <Text className="text-center text-xs text-muted-foreground">
        {t`Total`}{' '}
        <Text className={cn('font-semibold tabular-nums', pnlClass(grid.monthTotal))}>
          {formatPnlCompact(grid.monthTotal * fxRate, currency)}
        </Text>
      </Text>
    </DashboardCard>
  );
}
