import type { ReactNode } from "react";
import type { Summary, Trade } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { type InsightRow, buildInsightPanels, computeHomeInsights } from "@/lib/homeInsights";
import { fmtDuration, fmtMoney, fmtPct, fmtSignedMoney } from "@/lib/format";
import { intlLocale } from "@/lib/locale";
import { WinLossRecord } from "./WinLossRecord";
import { usePrivacyMode } from "@/lib/displayPrefs";

export interface HomeInsightBentoProps {
  summary: Summary;
  trades: Trade[];
  currency: string;
  fxRate?: number;
  maxDrawdown?: number;
}

function toneClass(tone?: InsightRow["tone"]): string {
  if (tone === "pos") return "text-profit";
  if (tone === "neg") return "text-destructive";
  if (tone === "muted") return "text-muted-foreground";
  return "text-foreground";
}

function BentoCell({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cn("flex h-full min-w-0 flex-col rounded-lg bg-card p-5", className)}>
      {children}
    </section>
  );
}

function Title({
  children,
  tone = "signal",
  className,
}: {
  children: ReactNode;
  tone?: "signal" | "muted";
  className?: string;
}) {
  return (
    <p
      className={cn(
        "self-start text-left text-[12px] font-semibold tracking-wide",
        tone === "signal" ? "text-chart-3" : "font-medium text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}

function WinLossHint({ hint }: { hint: string }) {
  const m = /^(\d+)W\s*\/\s*(\d+)L$/.exec(hint.trim());
  if (!m) {
    return <span className="text-[17px] text-muted-foreground">{hint}</span>;
  }
  return (
    <WinLossRecord
      wins={Number(m[1])}
      losses={Number(m[2])}
      separator=" / "
      className="text-[17px]"
    />
  );
}

function HeroValue({ row, center = false }: { row: InsightRow; center?: boolean }) {
  return (
    <div className={cn(center && "text-center")}>
      <div
        className={cn(
          "flex flex-wrap items-baseline gap-x-2.5 gap-y-1",
          center && "justify-center",
        )}
      >
        <p
          className={cn(
            "text-[43px] font-semibold leading-none tracking-[-0.04em] tabular-nums",
            toneClass(row.tone),
            row.tone === "pos" && "drop-shadow-[0_0_32px_rgba(74,222,128,0.3)]",
            row.tone === "neg" && "drop-shadow-[0_0_32px_rgba(251,113,133,0.24)]",
          )}
        >
          {row.value}
        </p>
        {row.hint ? <WinLossHint hint={row.hint} /> : null}
      </div>
    </div>
  );
}

function StatTile({ row, className }: { row: InsightRow; className?: string }) {
  return (
    <BentoCell className={className}>
      <Title tone="muted">{row.label}</Title>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
        <p
          className={cn(
            "text-[38px] font-semibold leading-none tracking-[-0.03em] tabular-nums",
            toneClass(row.tone),
          )}
        >
          {row.value}
        </p>
        {row.hint ? <p className="mt-1.5 text-[10px] text-muted-foreground">{row.hint}</p> : null}
      </div>
    </BentoCell>
  );
}

export function HomeInsightBento({
  summary,
  trades,
  currency,
  fxRate = 1,
  maxDrawdown,
}: HomeInsightBentoProps) {
  usePrivacyMode();
  const locale = intlLocale();
  const insights = computeHomeInsights(trades);
  const panels = buildInsightPanels(summary, insights, currency, locale, maxDrawdown, {
    money: (v) => fmtMoney(v * fxRate, currency, locale),
    signed: (v) => fmtSignedMoney(v * fxRate, currency, locale),
    pct: (r) => fmtPct(r, locale),
    duration: (secs) => (secs == null ? "—" : fmtDuration(Math.round(secs))),
  });

  const quality = panels[0];
  const stability = panels[1];
  const time = panels[2];

  const [bestTrade, worstTrade, maxDd, profitFactor] = quality.cells;
  const [bestStreak, worstStreak, bestDay, worstDay, mainLeak] = stability.cells;
  const [winHold, lossHold, topSymbol] = time.cells;

  return (
    <div className="grid auto-rows-[minmax(125px,auto)] grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-12 lg:auto-rows-[minmax(140px,1fr)]">
      {/* Feature cell — expectancy + edge metrics */}
      <BentoCell className="col-span-2 justify-between sm:col-span-4 lg:col-span-4 lg:row-span-2">
        <div>
          <Title>{quality.title}</Title>
          <Title tone="muted" className="mt-3">
            {quality.hero.label}
          </Title>
          <div className="mt-3 flex justify-center">
            <HeroValue row={quality.hero} center />
          </div>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4">
          {[bestTrade, worstTrade, maxDd, profitFactor].map((row) => (
            <div key={row.label}>
              <Title tone="muted">{row.label}</Title>
              <p
                className={cn(
                  "mt-1 text-[17px] font-semibold tabular-nums tracking-[-0.02em]",
                  toneClass(row.tone),
                )}
              >
                {row.value}
              </p>
              {row.hint ? (
                <p className="mt-0.5 text-[10px] text-muted-foreground">{row.hint}</p>
              ) : null}
            </div>
          ))}
        </div>
      </BentoCell>

      <BentoCell className="col-span-1 sm:col-span-2 lg:col-span-4">
        <Title>{stability.title}</Title>
        <Title tone="muted" className="mt-3">
          {stability.hero.label}
        </Title>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
          <HeroValue row={stability.hero} center />
        </div>
      </BentoCell>

      <BentoCell className="col-span-1 sm:col-span-2 lg:col-span-4">
        <Title>{time.title}</Title>
        <Title tone="muted" className="mt-3">
          {time.hero.label}
        </Title>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
          <HeroValue row={time.hero} center />
        </div>
      </BentoCell>

      <StatTile row={bestStreak} className="lg:col-span-2" />
      <StatTile row={worstStreak} className="lg:col-span-2" />
      <StatTile row={winHold} className="lg:col-span-2" />
      <StatTile row={lossHold} className="lg:col-span-2" />

      <StatTile row={bestDay} className="lg:col-span-3" />
      <StatTile row={worstDay} className="lg:col-span-3" />
      <StatTile row={topSymbol} className="lg:col-span-3" />
      <StatTile row={mainLeak} className="lg:col-span-3" />
    </div>
  );
}
