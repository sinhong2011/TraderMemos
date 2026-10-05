import { ChevronDown } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type { MistakeTaxReport, MistakeTaxSource, Trade } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { fmtDayShort } from "@/lib/format";
import { intlLocale } from "@/lib/locale";
import { useMoneyFormatters } from "@/lib/useMoneyFormatters";
import { Card } from "./Card";
import { EmptyState } from "./EmptyState";
import { Skeleton } from "./Skeleton";
import { pnlColor } from "./theme-tokens";

export interface ReportsMistakeTaxProps {
  report?: MistakeTaxReport;
  loading: boolean;
  error: boolean;
  /** Filtered trades, to label the ids behind each row. */
  trades: Trade[];
  currency: string;
  fxRate: number;
  onSelectTradeId?: (id: string) => void;
}

const KIND_LABEL: Record<MistakeTaxSource["kind"], string> = {
  tag: "Tag",
  rule: "Rule",
  behavior: "Behavior",
};

/**
 * "What did breaking my own process cost?" — losses on trades flagged by a
 * mistake tag, a broken risk rule or a detected revenge / oversized entry.
 * Winners among them never lower the tax; they show as "won anyway".
 */
export function ReportsMistakeTax({
  report,
  loading,
  error,
  trades,
  currency,
  fxRate,
  onSelectTradeId,
}: ReportsMistakeTaxProps) {
  const { fmtMoney, fmtSignedMoney } = useMoneyFormatters();
  const locale = intlLocale();
  const [open, setOpen] = useState<string | null>(null);
  const cost = (v: number) => fmtMoney(v * fxRate, currency, locale);
  const signed = (v: number) => fmtSignedMoney(v * fxRate, currency, locale);
  const tradeById = new Map(trades.map((t) => [t.id, t]));

  if (loading) {
    return (
      <Card title="Mistake tax">
        <Skeleton height="160px" />
      </Card>
    );
  }
  if (error || !report) {
    return (
      <Card title="Mistake tax">
        <p className="m-0 text-xs text-destructive">Failed to load the mistake tax.</p>
      </Card>
    );
  }
  if (report.flagged_trades === 0) {
    return (
      <Card title="Mistake tax">
        <EmptyState
          title="No mistakes logged in this range"
          hint="Tag a trade with a mistake (Chased, Moved stop…) or set risk rules in Settings, and what they cost shows up here."
        />
        {report.unreviewed_losses > 0 ? (
          <UnreviewedLine
            report={report}
            open={open === "unreviewed"}
            onToggle={() => setOpen(open === "unreviewed" ? null : "unreviewed")}
          />
        ) : null}
        {open === "unreviewed" ? (
          <TradeList
            ids={report.unreviewed_ids}
            tradeById={tradeById}
            signed={signed}
            locale={locale}
            onSelectTradeId={onSelectTradeId}
          />
        ) : null}
      </Card>
    );
  }

  const sourceMeta = (src: MistakeTaxSource) =>
    [
      `${src.trades} trade${src.trades === 1 ? "" : "s"}`,
      src.r_trades > 0 ? `${src.cost_r.toFixed(1)}R` : null,
      src.lucky > 0 ? `won anyway ${cost(src.lucky)}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  const maxCost = Math.max(...report.sources.map((s) => s.cost), 1);
  const maxPeriod = Math.max(...report.series.map((p) => p.cost), 1);
  const share = Math.round(report.share_of_losses * 100);

  return (
    <Card
      title="Mistake tax"
      description="Losses on trades that broke your own process — tags you applied, risk rules and detected revenge or oversized entries."
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="flex flex-col gap-1.5">
            <p className="m-0 text-[32px] leading-none font-semibold tracking-[-0.03em] tabular-nums text-foreground">
              {cost(report.total_cost)}
            </p>
            <p className="m-0 text-[13px] text-muted-foreground tabular-nums">
              {share}% of this range's losses
              {report.r_trades > 0 ? ` · ${report.total_cost_r.toFixed(1)}R` : ""}
              {" · "}
              {report.flagged_trades} trade{report.flagged_trades === 1 ? "" : "s"}
            </p>
            <p className="m-0 text-[13px] text-muted-foreground tabular-nums">
              Without them:{" "}
              <span className={cn("font-semibold", pnlColor(report.net_without))}>
                {signed(report.net_without)}
              </span>{" "}
              instead of{" "}
              <span className={cn("font-semibold", pnlColor(report.period_net))}>
                {signed(report.period_net)}
              </span>
            </p>
          </div>
          {report.series.length > 1 ? (
            <div className="flex flex-col items-end gap-1.5">
              <div
                className="flex h-12 items-end gap-[3px]"
                role="img"
                aria-label={`Mistake tax by ${report.bucket}`}
              >
                {report.series.map((p) => (
                  <span
                    key={p.period}
                    title={`${p.period}: ${cost(p.cost)}`}
                    className={cn(
                      "w-2.5 rounded-sm",
                      p.cost > 0 ? "bg-loss/70" : "bg-muted-foreground/25",
                    )}
                    style={{ height: `${Math.max((p.cost / maxPeriod) * 100, 6)}%` }}
                  />
                ))}
              </div>
              <span className="text-2xs text-muted-foreground">
                By {report.bucket} — lower is better
              </span>
            </div>
          ) : null}
        </div>

        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {report.sources.map((src) => {
            const isOpen = open === src.key;
            return (
              <li key={src.key} className="flex flex-col">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : src.key)}
                  className={cn(
                    "grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 rounded-md px-2 py-2 text-left",
                    "transition-colors duration-150 hover:bg-accent motion-reduce:transition-none",
                    "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    "sm:grid-cols-[minmax(0,18rem)_minmax(0,1fr)_auto]",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <ChevronDown
                      size={13}
                      strokeWidth={2}
                      aria-hidden
                      className={cn(
                        "shrink-0 text-muted-foreground transition-transform duration-150",
                        isOpen ? "rotate-0" : "-rotate-90",
                      )}
                    />
                    <span className="truncate text-[13px] font-medium text-foreground">
                      {src.label}
                    </span>
                    <span className="shrink-0 rounded-sm bg-muted px-1.5 py-px text-2xs text-muted-foreground">
                      {KIND_LABEL[src.kind]}
                    </span>
                  </span>
                  <span className="col-span-2 row-start-2 flex h-1.5 overflow-hidden rounded-full bg-muted sm:col-span-1 sm:row-start-auto">
                    <span
                      className="h-full rounded-full bg-loss/70"
                      style={{ width: `${(src.cost / maxCost) * 100}%` }}
                    />
                  </span>
                  <span className="flex flex-col items-end text-right tabular-nums">
                    <span className="text-[13px] font-semibold text-foreground">
                      {cost(src.cost)}
                    </span>
                    <span className="hidden text-2xs text-muted-foreground sm:inline">
                      {sourceMeta(src)}
                    </span>
                  </span>
                  {/* On phones the detail drops under the bar so the label keeps its width. */}
                  <span className="col-span-2 text-2xs text-muted-foreground tabular-nums sm:hidden">
                    {sourceMeta(src)}
                  </span>
                </button>
                {isOpen ? (
                  <TradeList
                    ids={src.trade_ids}
                    tradeById={tradeById}
                    signed={signed}
                    locale={locale}
                    onSelectTradeId={onSelectTradeId}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>

        <p className="m-0 text-2xs text-muted-foreground">
          A trade with several reasons counts under each, so rows can add up to more than the total.
        </p>

        {report.unreviewed_losses > 0 ? (
          <div className="flex flex-col">
            <UnreviewedLine
              report={report}
              open={open === "unreviewed"}
              onToggle={() => setOpen(open === "unreviewed" ? null : "unreviewed")}
            />
            {open === "unreviewed" ? (
              <TradeList
                ids={report.unreviewed_ids}
                tradeById={tradeById}
                signed={signed}
                locale={locale}
                onSelectTradeId={onSelectTradeId}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function UnreviewedLine({
  report,
  open,
  onToggle,
}: {
  report: MistakeTaxReport;
  open: boolean;
  onToggle: () => void;
}) {
  const n = report.unreviewed_losses;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="cursor-pointer self-start rounded-sm text-left text-[12px] font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {n} losing trade{n === 1 ? " has" : "s have"} no mistake tag or note —{" "}
        {open ? "hide" : "show"} {n === 1 ? "it" : "them"}
      </button>
      <Link to="/review" className="text-[12px] text-muted-foreground hover:text-foreground">
        Open the review inbox →
      </Link>
    </div>
  );
}

function TradeList({
  ids,
  tradeById,
  signed,
  locale,
  onSelectTradeId,
}: {
  ids: string[];
  tradeById: Map<string, Trade>;
  signed: (v: number) => string;
  locale: string;
  onSelectTradeId?: (id: string) => void;
}) {
  return (
    <ul className="m-0 mt-1 mb-2 ml-7 flex list-none flex-wrap gap-1.5 p-0">
      {ids.map((id) => {
        const t = tradeById.get(id);
        const pnl = t?.net_pnl ?? 0;
        return (
          <li key={id}>
            <button
              type="button"
              onClick={() => onSelectTradeId?.(id)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-[12px] tabular-nums hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <span className="font-medium text-foreground">{t?.symbol ?? "Trade"}</span>
              {t?.closed_at ? (
                <span className="text-muted-foreground">{fmtDayShort(t.closed_at, locale)}</span>
              ) : null}
              <span className={pnlColor(pnl)}>{signed(pnl)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
