import type { ReactNode } from "react";
import { Modal } from "./Modal";
import { Pill, type PillTone } from "./Pill";
import { SignalSelect } from "./SignalSelect";
import type { JournalTradePreview } from "../lib/api/types";
import { fmtDateTime, fmtMoney, fmtSignedMoney } from "../lib/format";
import type { OptionRightOverride } from "../lib/importOptionRight";
import { intlLocale } from "../lib/locale";
import { cn } from "../lib/cn";
import { heroPnlClass } from "./theme-tokens";
import { usePrivacyMode } from "../lib/displayPrefs";

function formatMarketLabel(trade: JournalTradePreview, optionRight: string): string {
  if (trade.instrument_type === "option") {
    const right = optionRight ? ` · ${optionRight.toUpperCase()}` : "";
    return `OPT${right}`;
  }
  return trade.market || trade.instrument_type?.toUpperCase() || "—";
}

function statusTone(status: string): PillTone {
  switch (status.toUpperCase()) {
    case "WIN":
      return "pos";
    case "LOSS":
      return "neg";
    case "OPEN":
      return "amber";
    default:
      return "muted";
  }
}

function sideTone(side: string): PillTone {
  switch (side.toUpperCase()) {
    case "LONG":
    case "BUY":
      return "accent";
    case "SHORT":
    case "SELL":
      return "amber";
    default:
      return "muted";
  }
}

function hasMeaningfulText(value: string | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "0" || trimmed === "0.0") return false;
  return true;
}

function DetailRow({
  label,
  value,
  valueClassName,
  children,
}: {
  label: string;
  value?: string;
  valueClassName?: string;
  children?: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-[0.08em] text-text-muted">{label}</p>
      {children ?? (
        <p className={cn("mt-1 truncate text-[13px] tabular-nums", valueClassName)}>{value}</p>
      )}
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[10px] uppercase tracking-[0.12em] text-text-muted">{title}</h3>
      <div className="grid gap-3 rounded-sharp border border-border bg-bg-inset px-3 py-3 sm:grid-cols-2">
        {children}
      </div>
    </section>
  );
}

export function ImportJournalDetailModal({
  trade,
  currency,
  open,
  onOpenChange,
  optionRight,
  onOptionRightChange,
}: {
  trade: JournalTradePreview | null;
  currency: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  optionRight?: string;
  onOptionRightChange?: (row: number, right: OptionRightOverride) => void;
}) {
  usePrivacyMode();
  if (!trade) return null;

  const locale = intlLocale();
  const resolvedOptionRight = optionRight ?? trade.option_right ?? "";
  const returnPctClass =
    trade.return_pct != null && trade.return_pct >= 0
      ? "text-profit"
      : trade.return_pct != null
        ? "text-loss"
        : "text-text-muted";

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={trade.symbol}>
      <div className="flex flex-col gap-5">
        <p className="m-0 text-[11px] text-text-muted">Import preview · Row {trade.row}</p>

        <div className="rounded-sharp border border-border bg-bg-inset px-4 py-4">
          <p className="text-[10px] uppercase tracking-[0.12em] text-text-muted">Return</p>
          <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-1">
            <p className={cn("m-0", heroPnlClass(trade.return_usd))}>
              {fmtSignedMoney(trade.return_usd, currency, locale)}
            </p>
            {trade.return_pct != null && trade.return_pct !== 0 ? (
              <p className={cn("m-0 text-[15px] font-semibold tabular-nums", returnPctClass)}>
                {trade.return_pct.toFixed(2)}%
              </p>
            ) : null}
          </div>
        </div>

        <DetailSection title="Trade">
          <DetailRow label="Symbol" value={trade.symbol} valueClassName="font-semibold text-text" />
          <DetailRow
            label="Market"
            value={formatMarketLabel(trade, resolvedOptionRight)}
            valueClassName="text-text-muted"
          />
          {trade.instrument_type === "option" ? (
            <DetailRow label="Option type">
              <div className="mt-1 flex flex-col gap-1.5">
                {onOptionRightChange ? (
                  <SignalSelect
                    value={resolvedOptionRight}
                    onValueChange={(value) => {
                      if (value === "call" || value === "put") {
                        onOptionRightChange(trade.row, value);
                      }
                    }}
                    ariaLabel="Option type"
                    options={[
                      { value: "", label: "Select call or put" },
                      { value: "call", label: "Call" },
                      { value: "put", label: "Put" },
                    ]}
                    triggerClassName="h-8 text-[12px]"
                  />
                ) : (
                  <span className="text-[13px] text-text">
                    {resolvedOptionRight ? resolvedOptionRight.toUpperCase() : "—"}
                  </span>
                )}
                {!resolvedOptionRight ? (
                  <p className="m-0 text-[10px] leading-relaxed text-text-dim">
                    Not in CSV export — pick call or put before importing.
                  </p>
                ) : null}
              </div>
            </DetailRow>
          ) : null}
          <DetailRow label="Side">
            <div className="mt-1">
              {trade.side ? (
                <Pill tone={sideTone(trade.side)}>{trade.side}</Pill>
              ) : (
                <span className="text-[13px] text-text-muted">—</span>
              )}
            </div>
          </DetailRow>
          <DetailRow label="Status">
            <div className="mt-1">
              {trade.status ? (
                <Pill tone={statusTone(trade.status)}>{trade.status}</Pill>
              ) : (
                <span className="text-[13px] text-text-muted">—</span>
              )}
            </div>
          </DetailRow>
          <DetailRow label="Qty" value={String(trade.qty)} />
        </DetailSection>

        <DetailSection title="Prices">
          <DetailRow label="Entry" value={trade.entry.toFixed(2)} />
          <DetailRow label="Exit" value={trade.exit.toFixed(2)} />
          {trade.entry_total != null && trade.entry_total > 0 ? (
            <DetailRow label="Entry total" value={fmtMoney(trade.entry_total, currency, locale)} />
          ) : null}
          {trade.exit_total != null && trade.exit_total > 0 ? (
            <DetailRow label="Exit total" value={fmtMoney(trade.exit_total, currency, locale)} />
          ) : null}
          {trade.dividends != null && trade.dividends !== 0 ? (
            <DetailRow
              label="Dividends"
              value={fmtSignedMoney(trade.dividends, currency, locale)}
              valueClassName={trade.dividends >= 0 ? "text-profit" : "text-loss"}
            />
          ) : null}
        </DetailSection>

        <DetailSection title="Timing">
          <DetailRow label="Opened" value={fmtDateTime(trade.open_date, locale)} />
          <DetailRow label="Closed" value={fmtDateTime(trade.close_date, locale)} />
        </DetailSection>

        {hasMeaningfulText(trade.setup) ||
        hasMeaningfulText(trade.confidence) ||
        hasMeaningfulText(trade.target) ||
        hasMeaningfulText(trade.stop) ||
        hasMeaningfulText(trade.tags) ? (
          <DetailSection title="Journal">
            {hasMeaningfulText(trade.setup) ? (
              <DetailRow label="Setup" value={trade.setup} valueClassName="text-text" />
            ) : null}
            {hasMeaningfulText(trade.confidence) ? (
              <DetailRow label="Confidence" value={trade.confidence} />
            ) : null}
            {hasMeaningfulText(trade.target) ? (
              <DetailRow label="Target" value={trade.target} />
            ) : null}
            {hasMeaningfulText(trade.stop) ? <DetailRow label="Stop" value={trade.stop} /> : null}
            {hasMeaningfulText(trade.tags) ? (
              <DetailRow label="Tags" value={trade.tags} valueClassName="text-text" />
            ) : null}
          </DetailSection>
        ) : null}

        {trade.notes ? (
          <section className="flex flex-col gap-2 border-t border-border pt-4">
            <h3 className="text-[10px] uppercase tracking-[0.12em] text-text-muted">Notes</h3>
            <p className="m-0 whitespace-pre-wrap rounded-sharp border border-border bg-bg-inset px-3 py-3 text-[12px] leading-relaxed text-text">
              {trade.notes}
            </p>
          </section>
        ) : null}
      </div>
    </Modal>
  );
}
