import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/Card";
import {
  ChartFrame,
  chartTheme,
  chartTooltipStyle,
  pnlTooltipValue,
} from "@/components/ChartFrame";
import { EmptyState } from "@/components/EmptyState";
import { ItemGroup } from "@/components/Item";
import { Page } from "@/components/Page";
import { Pill } from "@/components/Pill";
import { Skeleton } from "@/components/Skeleton";
import { StatCard } from "@/components/StatCard";
import { TradeListItem } from "@/components/TradeListItem";
import { Button } from "@/components/ui/button";
import type { ComplianceReport, JournalNote, Summary, Trade } from "@/lib/api/types";
import { noteExcerpt } from "@/components/editor/markdown";
import { usePrivacyMode } from "@/lib/displayPrefs";
import { fmtMoneyCompact, fmtSignedMoney, fmtTime } from "@/lib/format";
import { intlLocale } from "@/lib/locale";

export interface DayReviewViewProps {
  /** YYYY-MM-DD in the trader's timezone. */
  date: string;
  trades: Trade[];
  tradesLoading: boolean;
  tradesError: boolean;
  summary?: Summary;
  summaryLoading: boolean;
  compliance?: ComplianceReport;
  notes: JournalNote[];
  notesLoading: boolean;
  currency: string;
  fxRate?: number;
  onSelectTrade: (t: Trade) => void;
  onPrevDay: () => void;
  onNextDay: () => void;
  onOpenCalendar: () => void;
  onOpenNotes: () => void;
  onNewNote: () => void;
}

function formatDayTitle(date: string, locale: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Cumulative realized P&L over the session, stepped at each trade close. */
function IntradayCurve({
  trades,
  currency,
  fxRate,
}: {
  trades: Trade[];
  currency: string;
  fxRate: number;
}) {
  const locale = intlLocale();
  const closed = trades
    .filter((t) => t.closed_at != null && t.net_pnl != null)
    .sort((a, b) => String(a.closed_at).localeCompare(String(b.closed_at)));
  if (closed.length < 2) {
    return (
      <p className="m-0 text-[13px] leading-relaxed text-muted-foreground">
        Not enough closed trades to draw a session curve.
      </p>
    );
  }
  let cum = 0;
  const data = closed.map((t) => {
    cum += (t.net_pnl ?? 0) * fxRate;
    return { ts: new Date(String(t.closed_at)).getTime(), pnl: cum, symbol: t.symbol };
  });
  const stroke = cum >= 0 ? "var(--profit)" : "var(--loss)";

  return (
    <ChartFrame>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="dayPnlFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.25} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={chartTheme.gridColor} />
          <XAxis
            dataKey="ts"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(v: number) => fmtTime(new Date(v).toISOString(), locale)}
            tick={{ fill: chartTheme.axisColor, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
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
            labelFormatter={(v) => fmtTime(new Date(Number(v)).toISOString(), locale)}
            formatter={(value) => [
              pnlTooltipValue(
                Number(value ?? 0),
                fmtSignedMoney(Number(value ?? 0), currency, locale),
              ),
              "P&L",
            ]}
          />
          <Area
            type="stepAfter"
            dataKey="pnl"
            stroke={stroke}
            strokeWidth={1.5}
            fill="url(#dayPnlFill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/**
 * One trading day, reviewed the way pros review: what happened, was it inside
 * the rules, and what did I write down while it was fresh.
 */
export function DayReviewView({
  date,
  trades,
  tradesLoading,
  tradesError,
  summary,
  summaryLoading,
  compliance,
  notes,
  notesLoading,
  currency,
  fxRate = 1,
  onSelectTrade,
  onPrevDay,
  onNextDay,
  onOpenCalendar,
  onOpenNotes,
  onNewNote,
}: DayReviewViewProps) {
  usePrivacyMode();
  const locale = intlLocale();
  const day = compliance?.days.find((d) => d.date === date);
  const netPnl = (summary?.net_pnl ?? 0) * fxRate;
  const winRate = summary && summary.total_trades > 0 ? summary.win_rate : null;
  const dailyLogs = notes.filter((n) => n.type === "daily_log");
  const dayNotes = dailyLogs.length > 0 ? dailyLogs : notes;

  return (
    <Page fill>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Back to calendar"
            onClick={onOpenCalendar}
          >
            <ArrowLeft size={16} strokeWidth={1.5} />
          </Button>
          <h1 className="m-0 text-lg font-semibold tracking-tight">
            {formatDayTitle(date, locale)}
          </h1>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Previous day"
            onClick={onPrevDay}
          >
            <ChevronLeft size={16} strokeWidth={1.5} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Next day"
            onClick={onNextDay}
          >
            <ChevronRight size={16} strokeWidth={1.5} />
          </Button>
        </div>
      </div>

      <Card title="Session summary">
        {summaryLoading ? (
          <Skeleton height="88px" />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              <StatCard
                label="Net P&L"
                value={fmtSignedMoney(netPnl, currency, locale)}
                accent={netPnl >= 0 ? "pos" : "neg"}
              />
              <StatCard label="Trades" value={String(summary?.total_trades ?? 0)} />
              <StatCard
                label="Win rate"
                value={winRate != null ? `${(winRate * 100).toFixed(0)}%` : "—"}
              />
              <StatCard
                label="Fees"
                value={fmtSignedMoney(-(summary?.total_fees ?? 0) * fxRate, currency, locale)}
              />
            </div>
            {compliance?.rules_configured && (
              <div className="flex flex-wrap items-center gap-1.5">
                {day == null ? (
                  <Pill>no closed trades scored</Pill>
                ) : day.compliant ? (
                  <Pill tone="pos">rules followed</Pill>
                ) : (
                  <>
                    {day.risk_violations > 0 && (
                      <Pill tone="neg">over-risked ×{day.risk_violations}</Pill>
                    )}
                    {day.daily_loss_breach && <Pill tone="neg">daily loss breached</Pill>}
                  </>
                )}
                {day != null && day.unknown_risk > 0 && (
                  <Pill tone="amber">{day.unknown_risk} without recorded risk</Pill>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card title="Intraday P&L" description="Cumulative realized P&L as the session unfolded.">
        {tradesLoading ? (
          <Skeleton height="220px" />
        ) : (
          <IntradayCurve trades={trades} currency={currency} fxRate={fxRate} />
        )}
      </Card>

      <Card title={`Trades (${trades.length})`}>
        {tradesLoading ? (
          <Skeleton height="160px" />
        ) : tradesError ? (
          <p className="m-0 text-xs text-destructive">Failed to load trades.</p>
        ) : trades.length === 0 ? (
          <EmptyState title="No trades on this day" />
        ) : (
          <ItemGroup className="gap-2">
            {trades.map((t) => (
              <TradeListItem
                key={t.id}
                trade={t}
                currency={currency}
                fxRate={fxRate}
                onSelect={onSelectTrade}
              />
            ))}
          </ItemGroup>
        )}
      </Card>

      <Card
        title="Daily log"
        action={
          <Button type="button" variant="soft" size="sm" onClick={onNewNote}>
            New note
          </Button>
        }
      >
        {notesLoading ? (
          <Skeleton height="72px" />
        ) : dayNotes.length === 0 ? (
          <p className="m-0 text-[13px] leading-relaxed text-muted-foreground">
            Nothing journaled for this day yet. A two-minute recap while it&apos;s fresh beats a
            perfect writeup never written.
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {dayNotes.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={onOpenNotes}
                  className="flex w-full cursor-pointer flex-col gap-1 rounded-md border-none bg-transparent px-2 py-2 text-left transition-colors hover:bg-accent"
                >
                  <span className="text-[13px] font-medium text-foreground">
                    {n.title || (n.type === "daily_log" ? "Daily log" : "Note")}
                  </span>
                  <span className="text-xs leading-relaxed text-muted-foreground">
                    {noteExcerpt(n.body)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Page>
  );
}
