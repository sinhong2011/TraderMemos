import { t } from "@lingui/core/macro";
import { Card } from "@/components/Card";
import { Skeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import type { ReviewStats, SampleBand } from "@/lib/api/system";
import { accountBaseCurrency } from "@/lib/displayPrefs";
import { useFilterParams, useFilters } from "@/lib/filters";
import { useAccounts } from "@/lib/hooks/useAccounts";
import { useSystemReview } from "@/lib/hooks/useSystem";
import { intlLocale } from "@/lib/locale";
import { useMoneyFormatters } from "@/lib/useMoneyFormatters";
import { cn } from "@/lib/cn";

export function SystemReviewPanel() {
  const filters = useFilterParams();
  const accountIds = useFilters((s) => s.accountIds);
  const reviewQ = useSystemReview(filters);
  const accountsQ = useAccounts();
  const { fmtSignedMoney } = useMoneyFormatters();
  const currency = accountBaseCurrency(accountsQ.data ?? [], accountIds ?? undefined);
  const locale = intlLocale();
  const formatPnl = (n: number, c: string) => fmtSignedMoney(n, c, locale);
  const review = reviewQ.data;

  if (reviewQ.isLoading) return <Skeleton className="h-48" />;
  if (reviewQ.isError) {
    const msg = reviewQ.error instanceof Error ? reviewQ.error.message : t`Request failed`;
    return <EmptyState title={t`Could not load the review`} hint={msg} />;
  }
  if (!review) return null;

  const q = review.quadrant;
  const cell = (label: string, c: { trades: number; net_pnl: number }, warn?: boolean) => (
    <div className={cn("rounded-lg bg-muted/40 p-3", warn && "ring-1 ring-amber-500/50")}>
      <div className="text-2xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm tabular-nums">
        {c.trades} · {formatPnl(c.net_pnl, currency)}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <Card title={t`Coverage`}>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
          <Stat label={t`Closed`} value={String(review.coverage.closed)} />
          <Stat label={t`Carded`} value={String(review.coverage.carded)} />
          <Stat label={t`With regime`} value={String(review.coverage.regime)} />
          <Stat label={t`With adherence`} value={String(review.coverage.adherence)} />
          <Stat
            label={t`Adherence rate`}
            value={
              review.adherence_rate != null ? `${Math.round(review.adherence_rate * 100)}%` : "—"
            }
          />
          <Stat
            label={t`Hesitated misses`}
            value={String(review.missed_hesitated)}
            hint={t`Counted in range only — not in the adherence rate (no version on misses yet).`}
          />
        </dl>
      </Card>

      <Card
        title={t`Process × outcome`}
        description={t`Full adherence vs partial/none, against win vs loss. Wrong-but-won is the dangerous cell.`}
      >
        <div className="grid grid-cols-2 gap-2">
          {cell(t`Followed · won`, q.right_win)}
          {cell(t`Followed · lost`, q.right_loss)}
          {cell(t`Broke rules · won`, q.wrong_win, true)}
          {cell(t`Broke rules · lost`, q.wrong_loss)}
        </div>
      </Card>

      {review.streak ? (
        <Card
          title={t`Losing streak (${review.streak.length})`}
          description={t`Chance of this run given recent win rate: ${Math.round(review.streak.chance * 100)}%.`}
        >
          <ul className="flex flex-col gap-2">
            {review.streak.causes.map((c) => (
              <li key={c.key} className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                <div className="font-medium capitalize">
                  {c.key}{" "}
                  <span className="text-2xs font-normal text-muted-foreground tabular-nums">
                    {Math.round(c.score * 100)}%
                  </span>
                </div>
                <p className="text-2xs text-muted-foreground">{c.suggest}</p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {(
        [
          [t`By market`, review.by_regime],
          [t`By setup`, review.by_setup],
          [t`By exit state`, review.by_exit_state],
          [t`By trade type`, review.by_trade_type],
          [t`By version`, review.by_version],
          [t`By adherence`, review.by_adherence],
        ] as const
      ).map(([title, rows]) => (
        <StatsTable
          key={title}
          title={title}
          rows={rows}
          currency={currency}
          formatPnl={formatPnl}
        />
      ))}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-2xs text-muted-foreground">{label}</dt>
      <dd className="text-sm tabular-nums">{value}</dd>
      {hint ? <p className="mt-0.5 text-2xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function sampleLabel(s: SampleBand): string {
  switch (s) {
    case "thin":
      return t`Thin`;
    case "indicative":
      return t`Indicative`;
    case "adequate":
      return t`Adequate`;
  }
}

function sampleTone(s: SampleBand): string {
  return s === "adequate"
    ? "text-foreground"
    : s === "indicative"
      ? "text-amber-600"
      : "text-muted-foreground";
}

function StatsTable({
  title,
  rows,
  currency,
  formatPnl,
}: {
  title: string;
  rows: ReviewStats[];
  currency: string;
  formatPnl: (n: number, c: string) => string;
}) {
  return (
    <Card
      title={title}
      description={t`Under 10 trades a group says nothing; under 30 it only hints. Sample size is not proof.`}
      flush
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-start text-2xs text-muted-foreground">
              <th className="px-4 py-2 font-medium">{t`Group`}</th>
              <th className="px-4 py-2 font-medium">{t`N`}</th>
              <th className="px-4 py-2 font-medium">{t`Win%`}</th>
              <th className="px-4 py-2 font-medium">{t`Net`}</th>
              <th className="px-4 py-2 font-medium">{t`Sample`}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-3 text-muted-foreground">
                  {t`No data in this range.`}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.key} className="hover:bg-accent/50">
                  <td className="px-4 py-2">{r.key}</td>
                  <td className="px-4 py-2 tabular-nums">{r.trades}</td>
                  <td className="px-4 py-2 tabular-nums">{Math.round(r.win_rate * 100)}%</td>
                  <td className="px-4 py-2 tabular-nums">{formatPnl(r.net_pnl, currency)}</td>
                  <td className={cn("px-4 py-2 text-2xs", sampleTone(r.sample))}>
                    {sampleLabel(r.sample)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
