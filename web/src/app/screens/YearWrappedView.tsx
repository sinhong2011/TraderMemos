import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, PartyPopper } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/EmptyState";
import { Page } from "@/components/Page";
import { Skeleton } from "@/components/Skeleton";
import { pnlColor } from "@/components/theme-tokens";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { usePrivacyMode } from "@/lib/displayPrefs";
import { fmtDuration, fmtPct, fmtSignedMoney } from "@/lib/format";
import { intlLocale } from "@/lib/locale";
import type { YearWrapped } from "@/lib/wrapped";

export interface YearWrappedViewProps {
  wrapped: YearWrapped;
  loading: boolean;
  error: boolean;
  year: number;
  currentYear: number;
  onYearChange: (year: number) => void;
  currency: string;
  fxRate: number;
}

function WrappedCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cn("flex min-w-0 flex-col rounded-lg bg-card p-5 sm:p-6", className)}>
      {children}
    </section>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold tracking-[0.06em] uppercase text-chart-3 sm:text-[12px]">
      {children}
    </p>
  );
}

function StatCell({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "pos" | "neg" | "muted";
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 truncate text-[20px] font-semibold leading-none tracking-[-0.02em] tabular-nums",
          tone === "pos" && "text-profit",
          tone === "neg" && "text-destructive",
          tone === "muted" && "text-muted-foreground",
          !tone && "text-foreground",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 truncate text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Story-style annual recap computed from the year's closed trades. */
export function YearWrappedView({
  wrapped,
  loading,
  error,
  year,
  currentYear,
  onYearChange,
  currency,
  fxRate,
}: YearWrappedViewProps) {
  usePrivacyMode();
  const locale = intlLocale();
  const money = (v: number) => fmtSignedMoney(v * fxRate, currency, locale);

  const header = (
    <div className="mx-auto flex w-full max-w-2xl items-center justify-between">
      <h1 className="text-[20px] font-bold tracking-[-0.02em] text-foreground">
        {year} Wrapped
        {year === currentYear ? (
          <span className="ml-2 text-[12px] font-medium text-muted-foreground">so far</span>
        ) : null}
      </h1>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Previous year"
          onClick={() => onYearChange(year - 1)}
        >
          <ChevronLeft aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Next year"
          disabled={year >= currentYear}
          onClick={() => onYearChange(year + 1)}
        >
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <Page>
        {header}
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          <Skeleton height="180px" />
          <Skeleton height="120px" />
          <Skeleton height="120px" />
        </div>
      </Page>
    );
  }

  if (error) {
    return (
      <Page>
        {header}
        <p className="mx-auto w-full max-w-2xl p-4 text-xs text-destructive">
          Failed to load trades for {year}.
        </p>
      </Page>
    );
  }

  if (wrapped.totalTrades === 0) {
    return (
      <Page fill>
        {header}
        <EmptyState
          title={`No closed trades in ${year}`}
          hint="Import or log trades, then come back for the recap."
          icon={<PartyPopper aria-hidden />}
        />
      </Page>
    );
  }

  const maxMonthTrades = Math.max(...wrapped.months.map((m) => m.trades), 1);

  return (
    <Page>
      {header}
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        {/* Hero */}
        <WrappedCard className="items-center py-10 text-center">
          <Eyebrow>Your year in trading</Eyebrow>
          <p
            className={cn(
              "mt-4 text-[44px] font-semibold leading-none tracking-[-0.04em] tabular-nums sm:text-[52px]",
              pnlColor(wrapped.netPnl),
              wrapped.netPnl > 0 && "drop-shadow-[0_0_32px_rgba(74,222,128,0.3)]",
              wrapped.netPnl < 0 && "drop-shadow-[0_0_32px_rgba(251,113,133,0.24)]",
            )}
          >
            {money(wrapped.netPnl)}
          </p>
          <p className="mt-4 text-[13px] text-muted-foreground">
            {wrapped.totalTrades} trades · {fmtPct(wrapped.winRate, locale)} win rate ·{" "}
            {wrapped.tradingDays} days in the market
          </p>
        </WrappedCard>

        {/* Highs */}
        <WrappedCard>
          <Eyebrow>The highs</Eyebrow>
          <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-5">
            <StatCell
              label="Best day"
              value={wrapped.bestDay ? money(wrapped.bestDay.pnl) : "$0.00"}
              hint={wrapped.bestDay?.date}
              tone={wrapped.bestDay && wrapped.bestDay.pnl > 0 ? "pos" : "muted"}
            />
            <StatCell
              label="Biggest win"
              value={wrapped.biggestWin ? money(wrapped.biggestWin.pnl) : "$0.00"}
              hint={
                wrapped.biggestWin
                  ? `${wrapped.biggestWin.symbol} · ${wrapped.biggestWin.date}`
                  : undefined
              }
              tone={wrapped.biggestWin ? "pos" : "muted"}
            />
            <StatCell
              label="Longest win streak"
              value={String(wrapped.bestStreak)}
              hint={wrapped.bestStreak > 0 ? "wins in a row" : undefined}
              tone={wrapped.bestStreak > 0 ? "pos" : "muted"}
            />
            <StatCell
              label="Green days"
              value={String(wrapped.greenDays)}
              hint={`of ${wrapped.tradingDays} trading days`}
              tone={wrapped.greenDays > 0 ? "pos" : "muted"}
            />
          </div>
        </WrappedCard>

        {/* Lows */}
        <WrappedCard>
          <Eyebrow>The lessons</Eyebrow>
          <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-5">
            <StatCell
              label="Worst day"
              value={wrapped.worstDay ? money(wrapped.worstDay.pnl) : "$0.00"}
              hint={wrapped.worstDay?.date}
              tone={wrapped.worstDay && wrapped.worstDay.pnl < 0 ? "neg" : "muted"}
            />
            <StatCell
              label="Biggest loss"
              value={wrapped.biggestLoss ? money(wrapped.biggestLoss.pnl) : "$0.00"}
              hint={
                wrapped.biggestLoss
                  ? `${wrapped.biggestLoss.symbol} · ${wrapped.biggestLoss.date}`
                  : undefined
              }
              tone={wrapped.biggestLoss ? "neg" : "muted"}
            />
            <StatCell
              label="Longest loss streak"
              value={String(wrapped.worstStreak)}
              hint={wrapped.worstStreak > 0 ? "losses in a row" : undefined}
              tone={wrapped.worstStreak > 0 ? "neg" : "muted"}
            />
            <StatCell
              label="Red days"
              value={String(wrapped.redDays)}
              hint={`of ${wrapped.tradingDays} trading days`}
              tone={wrapped.redDays > 0 ? "neg" : "muted"}
            />
            {wrapped.mainMistake ? (
              <StatCell
                label="Most-tagged mistake"
                value={wrapped.mainMistake}
                hint="tagged on your journals"
                tone="neg"
              />
            ) : null}
          </div>
        </WrappedCard>

        {/* Rhythm */}
        <WrappedCard>
          <Eyebrow>Your rhythm</Eyebrow>
          <div className="mt-5 flex h-24 items-end gap-1.5" aria-hidden>
            {wrapped.months.map((m) => (
              <div key={m.month} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "w-full rounded-sm",
                    m.trades === 0 ? "bg-muted" : m.pnl >= 0 ? "bg-profit" : "bg-loss",
                  )}
                  style={{
                    height: `${m.trades === 0 ? 4 : Math.max(8, (m.trades / maxMonthTrades) * 72)}px`,
                  }}
                />
                <span className="text-[9px] text-muted-foreground">{m.label}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[13px] text-muted-foreground">
            {wrapped.busiestMonth ? (
              <>
                Busiest month:{" "}
                <span className="font-semibold text-foreground">{wrapped.busiestMonth.label}</span>{" "}
                with {wrapped.busiestMonth.trades} trades (
                <span className={pnlColor(wrapped.busiestMonth.pnl)}>
                  {money(wrapped.busiestMonth.pnl)}
                </span>
                ).
              </>
            ) : (
              "No monthly activity yet."
            )}
          </p>
        </WrappedCard>

        {/* Habits */}
        <WrappedCard>
          <Eyebrow>Your habits</Eyebrow>
          <div className="mt-4 space-y-2.5">
            {wrapped.topSymbols.map((s, i) => (
              <p
                key={s.symbol}
                className="flex items-baseline justify-between gap-3 text-[13px] tabular-nums"
              >
                <span className="min-w-0 truncate text-muted-foreground">
                  <span className="mr-2 font-semibold text-foreground">#{i + 1}</span>
                  {s.symbol}
                </span>
                <span className="shrink-0">
                  {s.trades} trades ·{" "}
                  <span className={cn("font-semibold", pnlColor(s.pnl))}>{money(s.pnl)}</span>
                </span>
              </p>
            ))}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-x-5">
            <StatCell label="Time in the market" value={fmtDuration(wrapped.totalHoldSecs)} />
            <StatCell label="Average hold" value={fmtDuration(wrapped.avgHoldSecs)} />
          </div>
        </WrappedCard>

        {/* Bottom line */}
        <WrappedCard>
          <Eyebrow>Bottom line</Eyebrow>
          <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-5 sm:grid-cols-3">
            <StatCell
              label="Profit factor"
              value={wrapped.profitFactor > 0 ? wrapped.profitFactor.toFixed(2) : "0.00"}
              tone={wrapped.profitFactor >= 1 ? "pos" : "neg"}
            />
            <StatCell
              label="Expectancy"
              value={money(wrapped.expectancy)}
              hint="per trade"
              tone={wrapped.expectancy >= 0 ? "pos" : "neg"}
            />
            <StatCell label="Fees paid" value={money(-wrapped.totalFees)} tone="neg" />
          </div>
          <Link
            to="/reports"
            search={{ tab: "overview", side: "all", dur: "all", pnl: "net", unit: "abs" }}
            className="mt-5 inline-flex text-[12px] font-medium text-primary no-underline hover:underline"
          >
            Dig into the full reports →
          </Link>
        </WrappedCard>
      </div>
    </Page>
  );
}
