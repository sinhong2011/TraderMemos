import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card } from "./Card";
import { DonutRing } from "./charts/DonutRing";
import { DIR_TONE_CLASS } from "./DirCell";
import { Pill } from "./Pill";
import { StatCell } from "./StatCell";
import { pnlColor } from "./theme-tokens";
import { marketLabel, tradeNotional, tradeStatus } from "./tradeColumns";
import type { TradeDetail } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { useDisplayTimePrefs, usePrivacyMode } from "@/lib/displayPrefs";
import { fmtMoney, fmtSignedMoney } from "@/lib/format";
import { intlLocale } from "@/lib/locale";
import { formatOptionContractLabel, optionContractFromFills } from "@/lib/optionContract";
import { resolveTradeDirection } from "@/lib/tradeDirection";
import type { TradeInsights } from "@/lib/tradeInsights";
import { fmtTradeTimeline } from "@/lib/tradeTimeline";

/**
 * The "what happened" block: identity, outcome, and the six numbers that
 * reconstruct the trade — entry, exit, size, hold, gross, fees.
 *
 * Net P&L appears exactly once on the page, here. The previous layout printed
 * the hero figure again inside a nested P&L tile a few hundred pixels below it,
 * which cost a screenful of height to say the same thing twice.
 */
export function TradeSummaryCard({
  trade,
  insights,
}: {
  trade: TradeDetail;
  insights: TradeInsights;
}) {
  usePrivacyMode();
  useDisplayTimePrefs();
  const locale = intlLocale();
  const currency = trade.pnl_currency;
  const status = tradeStatus(trade);
  const net = trade.net_pnl;
  const optionContract = optionContractFromFills(trade.fills);
  const dir = resolveTradeDirection({
    direction: trade.direction,
    instrumentType: trade.instrument_type,
    // The fills carry the contract, so an imported option resolves to LONG CALL
    // rather than falling back to symbol inference and rendering "LONG ?".
    optionRight: optionContract?.option_right ?? null,
    symbol: trade.symbol,
    markMissingOptionRight: true,
  });
  const DirIcon = dir.arrowUp ? ArrowUpRight : ArrowDownRight;
  const optionRight =
    dir.tag === "LC" || dir.tag === "SC"
      ? "CALL"
      : dir.tag === "LP" || dir.tag === "SP"
        ? "PUT"
        : null;
  const contract =
    trade.instrument_type === "option" ? formatOptionContractLabel(optionContract) : "";
  // Options quote per share but settle per contract, so the ×100 has to be
  // visible somewhere for the P&L to reconcile against the entry price.
  const multiplier = trade.fills[0]?.multiplier || (trade.instrument_type === "option" ? 100 : 1);
  const notional = tradeNotional(trade.qty_opened, trade.avg_entry_price, trade.instrument_type);
  const hasDividends = trade.dividend_total !== 0;

  return (
    <Card>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="m-0 text-[26px] leading-none font-semibold tracking-[-0.03em] text-foreground sm:text-[30px]">
                {trade.symbol}
              </h1>
              {/* Side and option right spelled out ("LONG CALL"), matching the
                  trade list row — tone rides on the arrow and the call/put word
                  so green/red elsewhere on the page still means outcome. */}
              <Pill tone="muted" title={dir.detail}>
                <DirIcon
                  size={11}
                  strokeWidth={2.75}
                  className={DIR_TONE_CLASS[dir.tone]}
                  aria-hidden
                />
                {dir.long ? "LONG" : "SHORT"}
                {optionRight ? (
                  <span className={DIR_TONE_CLASS[dir.tone]}>{optionRight}</span>
                ) : null}
                {dir.tag === "?" ? (
                  <>
                    <span className="opacity-70" aria-hidden>
                      ?
                    </span>
                    <span className="sr-only">{dir.label}</span>
                  </>
                ) : null}
              </Pill>
              <Pill tone={status.tone} title={status.label === "BE" ? "Break-even" : undefined}>
                {status.label}
              </Pill>
            </div>
            {/* Instrument and clock are two separate facts, so they get two
                lines instead of one string that wraps mid-contract. */}
            <p className="m-0 flex flex-wrap items-center gap-x-1.5 text-xs tabular-nums text-muted-foreground">
              <span>{marketLabel(trade.instrument_type)}</span>
              {contract ? (
                <>
                  <span aria-hidden>·</span>
                  <span className="whitespace-nowrap">{contract}</span>
                </>
              ) : null}
            </p>
            <p className="m-0 text-xs tabular-nums text-muted-foreground">
              {fmtTradeTimeline(trade, insights.holdLabel)}
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Execution score, not P&L — the ring grades process (entry heat,
                MFE capture) so it stays primary-tinted rather than riding the
                green/red outcome scale. */}
            {insights.execScore != null && (
              <DonutRing
                className="w-13 shrink-0"
                strokeWidth={10}
                segments={[
                  { value: insights.execScore, color: "var(--primary)" },
                  { value: 100 - insights.execScore, color: "transparent" },
                ]}
              >
                <span
                  className="text-[14px] font-semibold leading-none tabular-nums text-foreground"
                  title="Execution score — entry heat and MFE capture from auto excursion"
                >
                  {insights.execScore}
                </span>
              </DonutRing>
            )}
            <div className="flex flex-col gap-1.5 sm:items-end">
              <span
                className={cn(
                  "text-[32px] leading-none font-semibold tracking-[-0.03em] tabular-nums sm:text-[38px]",
                  net != null ? pnlColor(net) : "text-flat",
                )}
                title="Net P&L after fees"
              >
                {net != null ? fmtSignedMoney(net, currency, locale) : "—"}
              </span>
              <div className="flex flex-wrap items-baseline gap-x-3 sm:justify-end">
                {trade.return_pct != null && (
                  <span
                    className={cn("text-sm font-semibold tabular-nums", pnlColor(trade.return_pct))}
                  >
                    {trade.return_pct >= 0 ? "+" : ""}
                    {trade.return_pct.toFixed(2)}%
                  </span>
                )}
                {trade.r_multiple != null && (
                  <span
                    className={cn("text-sm font-semibold tabular-nums", pnlColor(trade.r_multiple))}
                    title="Realized R — net P&L ÷ planned risk"
                  >
                    {trade.r_multiple >= 0 ? "+" : ""}
                    {trade.r_multiple.toFixed(2)}R
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* One row of tiles instead of the three stacked bento blocks: same
            numbers, a third of the height, and the same tile treatment the
            home page gives its metrics. */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          <StatCell label="Entry">{fmtMoney(trade.avg_entry_price, currency, locale)}</StatCell>
          <StatCell label="Exit">
            {trade.avg_exit_price != null ? fmtMoney(trade.avg_exit_price, currency, locale) : "—"}
          </StatCell>
          <StatCell
            label="Size"
            hint={multiplier !== 1 ? `×${multiplier}` : fmtMoney(notional, currency, locale)}
          >
            {trade.qty_opened.toFixed(trade.qty_opened % 1 === 0 ? 0 : 2)}
          </StatCell>
          <StatCell label="Hold">{insights.holdLabel === "-" ? "—" : insights.holdLabel}</StatCell>
          <StatCell
            label="Gross"
            valueClassName={insights.grossPnl != null ? pnlColor(insights.grossPnl) : undefined}
          >
            {insights.grossPnl != null ? fmtSignedMoney(insights.grossPnl, currency, locale) : "—"}
          </StatCell>
          <StatCell
            label="Fees"
            // Fee drag is the number that explains a scratch trade turning red,
            // so it rides next to the amount instead of floating unlabeled.
            hint={
              insights.feeDragPct != null
                ? `${(insights.feeDragPct * 100).toFixed(1)}% of gross`
                : undefined
            }
          >
            {fmtMoney(insights.feesTotal, currency, locale)}
          </StatCell>
          {hasDividends && (
            <StatCell label="Dividends" valueClassName={pnlColor(trade.dividend_total)}>
              {fmtSignedMoney(trade.dividend_total, currency, locale)}
            </StatCell>
          )}
          {hasDividends && trade.total_pnl != null && (
            <StatCell
              label="Total"
              hint="incl. dividends"
              valueClassName={pnlColor(trade.total_pnl)}
            >
              {fmtSignedMoney(trade.total_pnl, currency, locale)}
            </StatCell>
          )}
        </div>
      </div>
    </Card>
  );
}
