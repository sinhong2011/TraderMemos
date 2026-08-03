import { ArrowLeftRight } from "lucide-react";
import { useState } from "react";
import { fieldInputClass } from "@/components/field-styles";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { DISPLAY_CURRENCIES } from "@/lib/displayPrefs";
import { fmtMoney } from "@/lib/format";
import { useFxRate } from "@/lib/hooks/useMoneyFx";
import { intlLocale } from "@/lib/locale";

const labelClass =
  "mb-1 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground";

function CurrencySelect({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (code: string) => void;
}) {
  return (
    <div className="min-w-0 flex-1">
      <label className={labelClass} htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className={fieldInputClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {DISPLAY_CURRENCIES.map((code) => (
          <option key={code} value={code}>
            {code}
          </option>
        ))}
      </select>
    </div>
  );
}

export function FxConverterModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [amount, setAmount] = useState("100");
  const [from, setFrom] = useState("USD");
  const [to, setTo] = useState("EUR");

  const same = from === to;
  const fxQ = useFxRate(from, to);
  const rate = same ? 1 : fxQ.data?.rate;

  const locale = intlLocale();
  const parsed = Number(amount.replaceAll(",", ""));
  const valid = Number.isFinite(parsed) && parsed >= 0;
  const converted = valid && rate != null ? parsed * rate : null;

  const asOf = fxQ.data?.as_of
    ? new Date(fxQ.data.as_of).toLocaleDateString(locale, { month: "short", day: "numeric" })
    : null;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Currency converter"
      className="max-w-[420px]"
    >
      <p className="m-0 text-xs leading-relaxed text-muted-foreground">
        Latest rates from the market data service — the same source the app uses for display
        currency conversion.
      </p>
      <div>
        <label className={labelClass} htmlFor="fx-amount">
          Amount
        </label>
        <input
          id="fx-amount"
          className={fieldInputClass}
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="100"
        />
      </div>
      <div className="flex items-end gap-2">
        <CurrencySelect id="fx-from" label="From" value={from} onChange={setFrom} />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Swap currencies"
          onClick={() => {
            setFrom(to);
            setTo(from);
          }}
        >
          <ArrowLeftRight size={14} strokeWidth={1.5} aria-hidden />
        </Button>
        <CurrencySelect id="fx-to" label="To" value={to} onChange={setTo} />
      </div>
      <div className="rounded-lg bg-muted/40 px-4 py-3">
        {converted != null ? (
          <>
            <p className="m-0 text-[22px] font-semibold tracking-[-0.02em] tabular-nums text-foreground">
              {fmtMoney(converted, to, locale)}
            </p>
            <p className="m-0 mt-1 text-[11px] tabular-nums text-muted-foreground">
              1 {from} = {rate === 1 ? "1" : rate?.toFixed(4)} {to}
              {asOf ? ` · ${asOf}` : ""}
            </p>
          </>
        ) : (
          <p className="m-0 text-xs text-muted-foreground">
            {!valid
              ? "Enter an amount to convert."
              : fxQ.isLoading
                ? "Fetching rate…"
                : "Rate unavailable right now."}
          </p>
        )}
      </div>
    </Modal>
  );
}
