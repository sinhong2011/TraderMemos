import { Eye, EyeOff, Search, Wallet, X } from "lucide-react";
import { DateRangePicker } from "./DateRangePicker";
import { SignalSelect } from "./SignalSelect";
import { ToolsPopover } from "./ToolsPopover";
import { heroPnlClass } from "./theme-tokens";
import { cn } from "../lib/cn";
import {
  accountBaseCurrency,
  DISPLAY_CURRENCIES,
  useDisplayPrefs,
  usePrivacyMode,
} from "../lib/displayPrefs";
import { useFilterParams, useFilters } from "../lib/filters";
import { APP_HOTKEYS } from "../lib/hotkeys";
import { fmtMoney, fmtPct, fmtSignedMoney } from "../lib/format";
import { computeHeaderStats } from "../lib/headerStats";
import { useAccounts } from "../lib/hooks/useAccounts";
import { useSummary } from "../lib/hooks/useAnalytics";
import { useCash } from "../lib/hooks/useCash";
import { useMoneyFx } from "../lib/hooks/useMoneyFx";
import { useTrades } from "../lib/hooks/useTrades";
import { intlLocale } from "../lib/locale";
import { useUI } from "../lib/ui";
import { signalKbdClass } from "./signal-field-styles";

const AUTO_VALUE = "__auto__";

function HeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1 text-[13px] font-medium whitespace-nowrap">
      <span className="uppercase tracking-widest text-text-muted">{label}</span>
      <span className="font-semibold tabular-nums text-text">{value}</span>
    </span>
  );
}

function StatDivider() {
  return (
    <span aria-hidden className="text-[13px] text-text-dim select-none">
      ·
    </span>
  );
}

function SymbolFilterChip({ symbol, onClear }: { symbol: string; onClear: () => void }) {
  return (
    <span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-control border border-accent/25 bg-accent-bg px-2 text-[11px] text-accent">
      {symbol}
      <button
        type="button"
        onClick={onClear}
        aria-label="Clear symbol filter"
        className="flex cursor-pointer items-center justify-center rounded-sharp p-0.5 text-accent/70 transition-colors hover:bg-accent/10 hover:text-accent"
      >
        <X size={12} strokeWidth={2} />
      </button>
    </span>
  );
}

function DisplayCurrencySelect({ baseCurrency }: { baseCurrency: string }) {
  const displayCurrency = useDisplayPrefs((s) => s.displayCurrency);
  const setDisplayCurrency = useDisplayPrefs((s) => s.setDisplayCurrency);
  const base = baseCurrency.trim().toUpperCase() || "USD";
  // `null` or an override that matches the account base = show in account currency (no FX).
  const usingAccount = displayCurrency === null || displayCurrency.toUpperCase() === base;

  const options = [
    {
      value: AUTO_VALUE,
      label: (
        <span className="inline-flex items-center gap-1.5">
          <span>{base}</span>
          <span className="text-text-dim" aria-hidden>
            ·
          </span>
          <Wallet size={12} strokeWidth={1.75} className="shrink-0 text-text-dim" aria-hidden />
          <span className="sr-only">account</span>
        </span>
      ),
      shortLabel: base,
    },
    ...DISPLAY_CURRENCIES.filter((code) => code !== base).map((code) => ({
      value: code,
      label: code,
    })),
  ];

  return (
    <SignalSelect
      value={usingAccount ? AUTO_VALUE : displayCurrency!}
      onValueChange={(v) => {
        if (v === AUTO_VALUE || v.toUpperCase() === base) {
          setDisplayCurrency(null);
          return;
        }
        if ((DISPLAY_CURRENCIES as readonly string[]).includes(v)) {
          setDisplayCurrency(v as (typeof DISPLAY_CURRENCIES)[number]);
        }
      }}
      options={options}
      ariaLabel={`Show amounts in (account ledger is ${base})`}
      triggerClassName="h-8 w-[4.65rem] shrink-0 !border-transparent px-2 text-[11px] font-medium tabular-nums hover:!border-transparent"
    />
  );
}

function PrivacyToggle() {
  const privacyMode = useDisplayPrefs((s) => s.privacyMode);
  const togglePrivacyMode = useDisplayPrefs((s) => s.togglePrivacyMode);
  const Icon = privacyMode ? EyeOff : Eye;

  return (
    <button
      type="button"
      onClick={togglePrivacyMode}
      aria-pressed={privacyMode}
      aria-label={privacyMode ? "Show sensitive amounts" : "Hide sensitive amounts"}
      title={privacyMode ? "Show amounts" : "Hide amounts"}
      className={cn(
        "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-control outline-none",
        "transition-[background-color,color] duration-200 ease-[var(--ease-out)]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        privacyMode
          ? "bg-accent-bg text-accent"
          : "bg-bg-input text-text-dim hover:bg-bg-input-hover hover:text-text",
      )}
    >
      <Icon size={15} strokeWidth={1.75} aria-hidden />
    </button>
  );
}

export function HeaderBar() {
  usePrivacyMode();
  const filters = useFilterParams();
  const accountId = useFilters((s) => s.accountId);
  const symbol = useFilters((s) => s.symbol);
  const setSymbol = useFilters((s) => s.setSymbol);
  const openCommandPalette = useUI((s) => s.openCommandPalette);

  const accounts = useAccounts().data ?? [];
  const summaryQ = useSummary(filters);
  const tradesQ = useTrades(filters);
  const cashQ = useCash(filters);

  const baseCurrency = accountBaseCurrency(accounts, accountId);
  const { currency, toDisplay, isLoading: fxLoading } = useMoneyFx(baseCurrency);
  const stats = computeHeaderStats({
    accounts,
    accountId,
    cashTx: cashQ.data ?? [],
    summary: summaryQ.data,
    trades: tradesQ.data ?? [],
  });
  const summary = summaryQ.data;

  return (
    <header className="grid h-[52px] shrink-0 grid-cols-[minmax(0,auto)_minmax(0,1fr)_auto] items-center gap-3 bg-bg px-4">
      {/* Performance strip */}
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={cn(
            heroPnlClass(stats.netPnl),
            "shrink-0 text-[28px]",
            fxLoading && "opacity-60",
          )}
        >
          {fmtSignedMoney(toDisplay(stats.netPnl), currency, intlLocale())}
        </div>
        <div aria-hidden className="hidden h-7 w-px shrink-0 bg-border sm:block" />
        <div className="hidden min-w-0 items-center gap-2 sm:flex">
          <HeaderStat label="WR" value={summary ? fmtPct(summary.win_rate, intlLocale()) : "—"} />
          <StatDivider />
          <HeaderStat
            label="PF"
            value={summary?.profit_factor != null ? summary.profit_factor.toFixed(2) : "—"}
          />
          <StatDivider />
          <HeaderStat
            label="Cash"
            value={fmtMoney(toDisplay(stats.cash), currency, intlLocale())}
          />
        </div>
      </div>

      {/* Command search — single entry point */}
      <div className="flex min-w-0 items-center justify-end gap-2 px-1">
        {symbol ? <SymbolFilterChip symbol={symbol} onClear={() => setSymbol(undefined)} /> : null}
        <button
          type="button"
          onClick={openCommandPalette}
          className={cn(
            "flex h-8 w-[120px] shrink-0 cursor-pointer items-center gap-1.5 rounded-control",
            "border-none bg-bg-input px-2.5",
            "text-[12px] font-medium text-text-dim",
            "transition-[background-color,color] duration-150",
            "hover:bg-bg-input-hover hover:text-text-muted",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          )}
        >
          <Search size={14} strokeWidth={1.75} aria-hidden />
          <span className="min-w-0 flex-1 truncate text-left">Search…</span>
          <kbd className={cn("hidden shrink-0 sm:inline", signalKbdClass)}>
            {APP_HOTKEYS.palette.label}
          </kbd>
        </button>
      </div>

      {/* Global filters */}
      <div className="flex shrink-0 items-center gap-1.5">
        <DateRangePicker />
        <DisplayCurrencySelect baseCurrency={baseCurrency} />
        <PrivacyToggle />
        <ToolsPopover variant="header" />
      </div>
    </header>
  );
}
