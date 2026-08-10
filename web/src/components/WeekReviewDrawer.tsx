import { X } from "lucide-react";
import { useId, useRef } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RectangleProps } from "recharts";
import { WinLossRecord } from "@/components/WinLossRecord";
import {
  ChartFrame,
  chartTheme,
  chartTooltipStyle,
  pnlTooltipValue,
} from "@/components/ChartFrame";
import type { DayCell, DayRecord, WeekDetail, WeekSummary } from "@/lib/calendar";
import { cn } from "@/lib/cn";
import { usePrivacyMode } from "@/lib/displayPrefs";
import { fmtMoney, fmtMoneyCompact, fmtPct, fmtSignedMoney, fmtSignedPct } from "@/lib/format";
import { intlLocale } from "@/lib/locale";
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "./Drawer";
import { pnlColor } from "./theme-tokens";
import { Button } from "./ui/button";

const POS_COLOR = "var(--profit)";
const NEG_COLOR = "var(--loss)";

function formatWeekRangeTitle(firstDate: string, lastDate: string): string {
  const locale = intlLocale();
  const start = new Date(`${firstDate}T12:00:00Z`);
  const end = new Date(`${lastDate}T12:00:00Z`);
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).formatRange(start, end);
}

function formatWeekDrawerTitle(weekSummary: WeekSummary): string {
  const range =
    weekSummary.firstDate && weekSummary.lastDate
      ? formatWeekRangeTitle(weekSummary.firstDate, weekSummary.lastDate)
      : "Week";
  if (weekSummary.weekNumber != null) {
    return `Week review — Week ${weekSummary.weekNumber} — ${range}`;
  }
  return `Week review — ${range}`;
}

function formatDayAxisLabel(isoDate: string, locale: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(d);
  const date = new Intl.DateTimeFormat(locale, {
    month: "numeric",
    day: "numeric",
    timeZone: "UTC",
  }).format(d);
  return `${weekday} ${date}`;
}

function formatDayLabel(isoDate: string, locale: string): string {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function dayTradeCount(rec: DayRecord | undefined): number {
  if (!rec) return 0;
  return rec.wins + rec.losses;
}

interface WeekDayChartPoint {
  date: string;
  label: string;
  cumPnl: number;
  dailyPnl: number | null;
  barPnl: number;
  hasTrades: boolean;
}

function buildWeekChartData(
  week: readonly (DayCell | null)[],
  fxRate: number,
): WeekDayChartPoint[] {
  const locale = intlLocale();
  let cum = 0;
  return week
    .filter((c): c is DayCell => c != null)
    .map((cell) => {
      if (cell.pnl != null) cum += cell.pnl * fxRate;
      const dailyPnl = cell.pnl != null ? cell.pnl * fxRate : null;
      return {
        date: cell.date,
        label: formatDayAxisLabel(cell.date, locale),
        cumPnl: cum,
        dailyPnl,
        barPnl: dailyPnl ?? 0,
        hasTrades: cell.pnl != null,
      };
    });
}

function WeekHero({
  pnl,
  detail,
  currency,
  fxRate,
}: {
  pnl: number;
  detail?: WeekDetail;
  currency: string;
  fxRate: number;
}) {
  usePrivacyMode();
  const locale = intlLocale();
  const moneyOf = (v: number) => fmtMoney(v * fxRate, currency, locale);

  return (
    <div className="flex flex-col gap-1">
      <p className={cn("m-0 text-[26px] font-semibold leading-tight tabular-nums", pnlColor(pnl))}>
        {fmtSignedMoney(pnl * fxRate, currency, locale)}
        {detail?.pct != null ? (
          <span className="ml-2 text-[15px] font-medium opacity-80">
            {fmtSignedPct(detail.pct, locale)}
          </span>
        ) : null}
      </p>
      {detail ? (
        <p className="m-0 text-[12px] tabular-nums text-muted-foreground">
          {moneyOf(detail.startBalance)} → {moneyOf(detail.endBalance)}
        </p>
      ) : null}
    </div>
  );
}

function WeekCumulativeChart({
  data,
  currency,
  fillId,
}: {
  data: WeekDayChartPoint[];
  currency: string;
  fillId: string;
}) {
  const locale = intlLocale();
  const finalCum = data.length > 0 ? data[data.length - 1]!.cumPnl : 0;
  const stroke = finalCum >= 0 ? POS_COLOR : NEG_COLOR;

  return (
    <div data-testid="week-review-cumulative-chart">
      <ChartFrame>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.25} />
                <stop offset="100%" stopColor={stroke} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={chartTheme.gridColor} />
            <XAxis
              dataKey="label"
              tick={{ fill: chartTheme.axisColor, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={(v: number) => fmtMoneyCompact(v, currency, locale)}
              tick={{ fill: chartTheme.axisColor, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={64}
            />
            <Tooltip
              {...chartTooltipStyle}
              labelFormatter={(_, payload) => {
                const row = payload?.[0]?.payload as WeekDayChartPoint | undefined;
                return row ? formatDayLabel(row.date, locale) : "";
              }}
              formatter={(value) => [
                pnlTooltipValue(
                  Number(value ?? 0),
                  fmtSignedMoney(Number(value ?? 0), currency, locale),
                ),
                "Cumulative P&L",
              ]}
            />
            <Area
              type="stepAfter"
              dataKey="cumPnl"
              stroke={stroke}
              strokeWidth={1.5}
              fill={`url(#${fillId})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartFrame>
    </div>
  );
}

function WeekDayBarShape(props: RectangleProps & { payload?: WeekDayChartPoint }) {
  const { x = 0, y = 0, width = 0, height = 0, payload } = props;
  if (!payload) return null;
  const slotHeight = payload.hasTrades ? height : 6;
  const slotY = payload.hasTrades ? y : y + height - slotHeight;
  return (
    <rect
      x={x}
      y={slotY}
      width={width}
      height={Math.max(slotHeight, 1)}
      rx={2}
      ry={2}
      fill={
        payload.hasTrades
          ? payload.barPnl >= 0
            ? POS_COLOR
            : NEG_COLOR
          : "var(--muted-foreground)"
      }
      fillOpacity={payload.hasTrades ? 0.85 : 0.2}
      data-testid={`week-bar-${payload.date}`}
      className="cursor-pointer"
    />
  );
}

function WeekDailyBars({
  data,
  currency,
  onSelectDay,
}: {
  data: WeekDayChartPoint[];
  currency: string;
  onSelectDay: (day: string) => void;
}) {
  const locale = intlLocale();

  return (
    <div data-testid="week-review-daily-bars">
      <ChartFrame>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={chartTheme.gridColor} />
            <XAxis
              dataKey="label"
              tick={{ fill: chartTheme.axisColor, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={(v: number) => fmtMoneyCompact(v, currency, locale)}
              tick={{ fill: chartTheme.axisColor, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={64}
            />
            <ReferenceLine y={0} stroke={chartTheme.axisColor} strokeOpacity={0.35} />
            <Tooltip
              {...chartTooltipStyle}
              labelFormatter={(_, payload) => {
                const row = payload?.[0]?.payload as WeekDayChartPoint | undefined;
                return row ? formatDayLabel(row.date, locale) : "";
              }}
              formatter={(_, __, item) => {
                const row = item.payload as WeekDayChartPoint;
                if (!row.hasTrades) return ["No trades", "Daily P&L"];
                const v = row.dailyPnl ?? 0;
                return [pnlTooltipValue(v, fmtSignedMoney(v, currency, locale)), "Daily P&L"];
              }}
              cursor={{ fill: chartTheme.cursorFill }}
            />
            <Bar
              dataKey="barPnl"
              isAnimationActive={false}
              shape={WeekDayBarShape}
              onClick={(bar) => {
                const row = (bar as { payload?: WeekDayChartPoint }).payload;
                if (row?.date) onSelectDay(row.date);
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>
    </div>
  );
}

function WeekStatGrid({
  detail,
  currency,
  fxRate,
}: {
  detail: WeekDetail;
  currency: string;
  fxRate: number;
}) {
  const locale = intlLocale();
  const moneyOf = (v: number) => fmtMoney(v * fxRate, currency, locale);

  const stats: { label: string; value: string }[] = [
    {
      label: "Win rate",
      value: detail.winRate != null ? fmtPct(detail.winRate, locale) : "0.0%",
    },
    {
      label: "Profit factor",
      value:
        detail.profitFactor != null
          ? Number.isFinite(detail.profitFactor)
            ? detail.profitFactor.toFixed(2)
            : "∞"
          : "0.00",
    },
    {
      label: "Expectancy",
      value:
        detail.expectancy != null
          ? fmtSignedMoney(detail.expectancy * fxRate, currency, locale)
          : fmtSignedMoney(0, currency, locale),
    },
    { label: "Comm & fees", value: moneyOf(detail.fees) },
    {
      label: "Trading days",
      value: String(detail.tradingDays),
    },
    { label: "Trades", value: String(detail.trades) },
  ];

  return (
    <div className="flex flex-col gap-2" data-testid="week-review-stat-grid">
      <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-2 text-[12px] tabular-nums">
        {stats.map((row) => (
          <div key={row.label} className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="m-0 font-medium text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>
      {(detail.bestDay || detail.worstDay) && (
        <dl className="m-0 mt-1 grid grid-cols-1 gap-1.5 text-[12px] tabular-nums">
          {detail.bestDay ? (
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">Best</dt>
              <dd className={cn("m-0 text-right font-medium", pnlColor(detail.bestDay.pnl))}>
                {formatDayLabel(detail.bestDay.date, locale)} ·{" "}
                {fmtSignedMoney(detail.bestDay.pnl * fxRate, currency, locale)}
              </dd>
            </div>
          ) : null}
          {detail.worstDay ? (
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">Worst</dt>
              <dd className={cn("m-0 text-right font-medium", pnlColor(detail.worstDay.pnl))}>
                {formatDayLabel(detail.worstDay.date, locale)} ·{" "}
                {fmtSignedMoney(detail.worstDay.pnl * fxRate, currency, locale)}
              </dd>
            </div>
          ) : null}
        </dl>
      )}
    </div>
  );
}

export interface WeekReviewDrawerProps {
  weekReviewIndex: number | null;
  onClose: () => void;
  week: ({ date: string; pnl: number | null } | null)[];
  weekSummary: WeekSummary;
  detail?: WeekDetail;
  records: Record<string, DayRecord>;
  currency: string;
  fxRate?: number;
  onSelectDay: (day: string) => void;
}

export function WeekReviewDrawer({
  weekReviewIndex,
  onClose,
  week,
  weekSummary,
  detail,
  records,
  currency,
  fxRate = 1,
  onSelectDay,
}: WeekReviewDrawerProps) {
  const open = weekReviewIndex != null;
  const snapshotRef = useRef({ week, weekSummary, detail });
  if (open) {
    snapshotRef.current = { week, weekSummary, detail };
  }
  const {
    week: displayWeek,
    weekSummary: displaySummary,
    detail: displayDetail,
  } = snapshotRef.current;
  const title = formatWeekDrawerTitle(displaySummary);
  const days = displayWeek.filter((c): c is { date: string; pnl: number | null } => c != null);
  const chartData = buildWeekChartData(displayWeek, fxRate);
  const fillId = useId().replace(/:/g, "");
  const hasChartData = displaySummary.hasData && chartData.length > 0;

  return (
    <Drawer
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      modal="trap-focus"
    >
      <DrawerContent className="[--drawer-content-width:min(440px,calc(100vw-2*var(--drawer-inset)))]">
        <DrawerHeader className="px-4 py-3">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerClose
            aria-label="Close"
            className="ml-auto flex cursor-pointer rounded-md border-none bg-transparent p-1 text-muted-foreground transition-colors duration-150 ease-out hover:bg-accent hover:text-foreground motion-reduce:transition-none"
          >
            <X size={18} strokeWidth={1.5} />
          </DrawerClose>
        </DrawerHeader>
        <DrawerBody className="gap-0 p-0">
          <div className="flex flex-col gap-4 px-4 pb-4">
            {displaySummary.hasData ? (
              <>
                <WeekHero
                  pnl={displaySummary.pnl}
                  detail={displayDetail}
                  currency={currency}
                  fxRate={fxRate}
                />
                {hasChartData ? (
                  <div className="flex flex-col gap-3" data-testid="week-review-chart-region">
                    <WeekCumulativeChart data={chartData} currency={currency} fillId={fillId} />
                    <WeekDailyBars data={chartData} currency={currency} onSelectDay={onSelectDay} />
                  </div>
                ) : null}
                {displayDetail ? (
                  <WeekStatGrid detail={displayDetail} currency={currency} fxRate={fxRate} />
                ) : null}
              </>
            ) : (
              <p className="m-0 text-[14px] text-muted-foreground" data-testid="week-review-empty">
                No trades
              </p>
            )}
          </div>
          {days.length > 0 ? (
            <ul className="m-0 flex flex-col gap-0.5 px-2 pb-4">
              {days.map((cell) => {
                const rec = records[cell.date];
                const trades = dayTradeCount(rec);
                const hasPnl = cell.pnl != null;
                return (
                  <li key={cell.date}>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto w-full justify-between rounded-md px-3 py-2 text-left transition-colors duration-150 ease-out motion-reduce:transition-none"
                      onClick={() => onSelectDay(cell.date)}
                    >
                      <span className="text-[13px] text-foreground">
                        {formatDayLabel(cell.date, intlLocale())}
                      </span>
                      <span className="flex items-center gap-2 text-[12px] tabular-nums">
                        {hasPnl ? (
                          <span className={cn("font-semibold", pnlColor(cell.pnl!))}>
                            {fmtSignedMoney(cell.pnl! * fxRate, currency, intlLocale())}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">No trades</span>
                        )}
                        {trades > 0 ? (
                          <>
                            <span className="text-muted-foreground">
                              {trades} {trades === 1 ? "trade" : "trades"}
                            </span>
                            {rec ? <WinLossRecord wins={rec.wins} losses={rec.losses} /> : null}
                          </>
                        ) : null}
                      </span>
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
