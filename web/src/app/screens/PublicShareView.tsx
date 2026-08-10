import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Link2Off } from "lucide-react";
import { type ReactNode, useId } from "react";
import { AppLogo } from "@/components/AppLogo";
import { DonutRing } from "@/components/charts/DonutRing";
import { GaugeArc } from "@/components/charts/GaugeArc";
import { Skeleton } from "@/components/Skeleton";
import { pnlColor } from "@/components/theme-tokens";
import { WinLossRecord } from "@/components/WinLossRecord";
import { cn } from "@/lib/cn";
import type { PublicShareSummary } from "@/lib/api/share";
import { fmtPct, fmtSignedMoney } from "@/lib/format";
import { usePublicShare } from "@/lib/hooks/useShareLinks";
import { intlLocale } from "@/lib/locale";

export interface PublicShareViewProps {
  token: string;
}

function ShareCard({ className, children }: { className?: string; children: ReactNode }) {
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

/** Cumulative P&L line as a plain SVG — the page must not need authed chart state. */
function ShareEquityLine({ data }: { data: PublicShareSummary }) {
  const gradId = useId();
  const points = data.equity;
  if (points.length < 2) return null;
  const values = points.map((p) => p.value);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = max - min || 1;
  const w = 560;
  const h = 160;
  const step = w / (points.length - 1);
  const y = (v: number) => h - ((v - min) / range) * h;
  const path = values
    .map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)} ${y(v).toFixed(1)}`)
    .join(" ");
  const last = values[values.length - 1];
  const lineClass = last >= 0 ? "stroke-profit" : "stroke-loss";
  const fillClass = last >= 0 ? "fill-profit" : "fill-loss";
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="mt-4 h-36 w-full"
      preserveAspectRatio="none"
      role="img"
      aria-label={t`Cumulative P&L curve`}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopOpacity="0.25" className={fillClass} stopColor="currentColor" />
          <stop offset="100%" stopOpacity="0" className={fillClass} stopColor="currentColor" />
        </linearGradient>
      </defs>
      <path d={`${path} L${w} ${h} L0 ${h} Z`} className={fillClass} opacity="0.12" stroke="none" />
      {min < 0 && max > 0 ? (
        <line
          x1="0"
          x2={w}
          y1={y(0)}
          y2={y(0)}
          className="stroke-muted-foreground"
          strokeOpacity="0.3"
          strokeDasharray="4 4"
        />
      ) : null}
      <path d={path} fill="none" strokeWidth="2" className={lineClass} />
    </svg>
  );
}

/** Read-only public performance page behind a share link (`/s/$token`). */
export function PublicShareView({ token }: PublicShareViewProps) {
  const { data, isPending, isError } = usePublicShare(token);
  const locale = intlLocale();

  const header = (
    <header className="mx-auto flex w-full max-w-2xl items-center gap-2.5">
      <AppLogo size={26} />
      <div className="min-w-0">
        <p className="text-[14px] font-bold tracking-[-0.01em] text-foreground">TraderMemos</p>
        <p className="text-[11px] text-muted-foreground">{t`Shared performance record`}</p>
      </div>
    </header>
  );

  if (isPending) {
    return (
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        {header}
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          <Skeleton height="180px" />
          <Skeleton height="120px" />
          <Skeleton height="120px" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-svh flex-col gap-4 p-4 sm:p-6">
        {header}
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 pb-24 text-center">
          <Link2Off aria-hidden className="size-8 text-muted-foreground" />
          <h1 className="text-[17px] font-semibold text-foreground">{t`This link isn't available`}</h1>
          <p className="text-[13px] text-muted-foreground">
            {t`It may have expired or been revoked by its owner.`}
          </p>
        </div>
      </div>
    );
  }

  const s = data.summary;
  const showAmounts = data.show_amounts;
  const currency = data.currency ?? "USD";
  const money = (v: number) => fmtSignedMoney(v, currency, locale);
  const range =
    data.first_day && data.last_day
      ? data.first_day === data.last_day
        ? data.first_day
        : `${data.first_day} — ${data.last_day}`
      : null;
  const pf = s.profit_factor;
  const pfFraction = pf <= 0 ? 0 : Math.min(1, pf / 3);
  const maxMonthTrades = Math.max(...data.months.map((m) => m.trades), 1);

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      {header}
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        {/* Hero */}
        <ShareCard className="items-center py-10 text-center">
          <Eyebrow>{showAmounts ? t`Net P&L` : t`Win rate`}</Eyebrow>
          <p
            className={cn(
              "mt-4 text-[44px] font-semibold leading-none tracking-[-0.04em] tabular-nums sm:text-[52px]",
              showAmounts ? pnlColor(s.net_pnl ?? 0) : "text-foreground",
              showAmounts && (s.net_pnl ?? 0) > 0 && "drop-shadow-[0_0_32px_rgba(74,222,128,0.3)]",
              showAmounts &&
                (s.net_pnl ?? 0) < 0 &&
                "drop-shadow-[0_0_32px_rgba(251,113,133,0.24)]",
            )}
          >
            {showAmounts ? money(s.net_pnl ?? 0) : fmtPct(s.win_rate, locale)}
          </p>
          <p className="mt-4 text-[13px] text-muted-foreground">
            {t`${s.total_trades} trades`}
            {showAmounts ? <> · {t`${fmtPct(s.win_rate, locale)} win rate`}</> : null} ·{" "}
            {t`${data.trading_days} days in the market`}
          </p>
          {range ? <p className="mt-1 text-[11px] text-muted-foreground">{range}</p> : null}
        </ShareCard>

        {/* Edge */}
        <ShareCard>
          <Eyebrow>{t`The edge`}</Eyebrow>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:gap-5">
            <div className="flex flex-col items-center justify-center">
              <p className="mb-2 self-start text-[11px] text-muted-foreground">{t`Profit factor`}</p>
              <GaugeArc
                value={pfFraction}
                className="w-full max-w-[148px]"
                gradientId="share-pf-gauge"
              >
                <span
                  className={cn(
                    "text-[22px] font-semibold leading-none tracking-[-0.03em] tabular-nums sm:text-[24px]",
                    pf >= 1 ? "text-profit" : pf > 0 ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {pf > 0 ? pf.toFixed(2) : "0.00"}
                </span>
              </GaugeArc>
              <p className="mt-1 text-[10px] text-muted-foreground">{t`1.0 = break-even`}</p>
            </div>
            <div className="flex flex-col items-center justify-center">
              <p className="mb-2 self-start text-[11px] text-muted-foreground">{t`Win rate`}</p>
              <DonutRing
                className="w-full max-w-[120px]"
                segments={[
                  { value: s.wins, color: "var(--profit)" },
                  { value: s.losses, color: "var(--loss)" },
                  { value: s.breakeven, color: "var(--muted-foreground)" },
                ]}
              >
                <span className="text-[18px] font-semibold leading-none tabular-nums text-foreground sm:text-[20px]">
                  {fmtPct(s.win_rate, locale)}
                </span>
                <WinLossRecord
                  wins={s.wins}
                  losses={s.losses}
                  separator=" / "
                  className="mt-1 text-[11px]"
                />
              </DonutRing>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-5 sm:grid-cols-3">
            {showAmounts && s.expectancy != null ? (
              <StatCell
                label={t`Expectancy`}
                value={money(s.expectancy)}
                hint={t`per trade`}
                tone={s.expectancy >= 0 ? "pos" : "neg"}
              />
            ) : null}
            <StatCell
              label={t`Kelly`}
              value={`${s.kelly_pct.toFixed(1)}%`}
              tone={s.kelly_pct > 0 ? "pos" : "muted"}
            />
            <StatCell label={t`SQN`} value={s.sqn.toFixed(2)} tone={s.sqn >= 2 ? "pos" : "muted"} />
          </div>
        </ShareCard>

        {/* Equity curve */}
        {data.equity.length >= 2 ? (
          <ShareCard>
            <Eyebrow>{t`The curve`}</Eyebrow>
            <ShareEquityLine data={data} />
            <p className="mt-2 text-[11px] text-muted-foreground">
              {showAmounts
                ? t`Cumulative net P&L over the shared period.`
                : t`Cumulative P&L shape — amounts are not shared.`}
            </p>
          </ShareCard>
        ) : null}

        {/* Consistency */}
        <ShareCard>
          <Eyebrow>{t`Consistency`}</Eyebrow>
          <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-5">
            <StatCell
              label={t`Green days`}
              value={String(data.green_days)}
              hint={t`of ${data.trading_days} trading days`}
              tone={data.green_days > 0 ? "pos" : "muted"}
            />
            <StatCell
              label={t`Red days`}
              value={String(data.red_days)}
              hint={t`of ${data.trading_days} trading days`}
              tone={data.red_days > 0 ? "neg" : "muted"}
            />
            <StatCell
              label={t`Longest green streak`}
              value={String(data.best_streak)}
              hint={data.best_streak > 0 ? t`days in a row` : undefined}
              tone={data.best_streak > 0 ? "pos" : "muted"}
            />
            <StatCell
              label={t`Longest red streak`}
              value={String(data.worst_streak)}
              hint={data.worst_streak > 0 ? t`days in a row` : undefined}
              tone={data.worst_streak > 0 ? "neg" : "muted"}
            />
            {showAmounts && data.best_day_pnl != null ? (
              <StatCell
                label={t`Best day`}
                value={money(data.best_day_pnl)}
                tone={data.best_day_pnl > 0 ? "pos" : "muted"}
              />
            ) : null}
            {showAmounts && data.worst_day_pnl != null ? (
              <StatCell
                label={t`Worst day`}
                value={money(data.worst_day_pnl)}
                tone={data.worst_day_pnl < 0 ? "neg" : "muted"}
              />
            ) : null}
          </div>
        </ShareCard>

        {/* Rhythm */}
        {data.months.length > 0 ? (
          <ShareCard>
            <Eyebrow>{t`The rhythm`}</Eyebrow>
            <div className="mt-5 flex h-24 items-end gap-1.5" aria-hidden>
              {data.months.map((m) => (
                <div key={m.month} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                  <div
                    className={cn(
                      "w-full rounded-sm",
                      m.trades === 0
                        ? "bg-muted"
                        : m.pnl == null
                          ? "bg-primary/60"
                          : m.pnl >= 0
                            ? "bg-profit"
                            : "bg-loss",
                    )}
                    style={{
                      height: `${m.trades === 0 ? 4 : Math.max(8, (m.trades / maxMonthTrades) * 72)}px`,
                    }}
                  />
                  <span className="text-[9px] text-muted-foreground">{m.month.slice(5)}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[11px] text-muted-foreground">{t`Trades per month.`}</p>
          </ShareCard>
        ) : null}

        {/* Top symbols */}
        {data.top_symbols.length > 0 ? (
          <ShareCard>
            <Eyebrow>{t`Most traded`}</Eyebrow>
            <div className="mt-4 space-y-2.5">
              {data.top_symbols.map((sym, i) => (
                <p
                  key={sym.symbol}
                  className="flex items-baseline justify-between gap-3 text-[13px] tabular-nums"
                >
                  <span className="min-w-0 truncate text-muted-foreground">
                    <span className="mr-2 font-semibold text-foreground">#{i + 1}</span>
                    {sym.symbol}
                  </span>
                  <span className="shrink-0">
                    {t`${sym.trades} trades`}
                    {sym.pnl != null ? (
                      <>
                        {" · "}
                        <span className={cn("font-semibold", pnlColor(sym.pnl))}>
                          {money(sym.pnl)}
                        </span>
                      </>
                    ) : null}
                  </span>
                </p>
              ))}
            </div>
          </ShareCard>
        ) : null}

        <footer className="flex items-center justify-center gap-2 py-4 text-[11px] text-muted-foreground">
          <AppLogo size={16} />
          <span>
            <Trans>
              Journaled with <span className="font-semibold text-foreground">TraderMemos</span> —
              the self-hosted trading journal
            </Trans>
          </span>
        </footer>
      </div>
    </div>
  );
}
