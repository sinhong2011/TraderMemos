import { Eye, EyeOff, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { currencyIcon, currencyRegion, currencySymbol } from "@/lib/currency";
import {
  accountBaseCurrency,
  DISPLAY_CURRENCIES,
  useDisplayPrefs,
  usePrivacyMode,
} from "@/lib/displayPrefs";
import { useFilterParams, useFilters } from "@/lib/filters";
import { APP_HOTKEYS } from "@/lib/hotkeys";
import { fmtMoney, fmtPct, fmtSignedMoney, fmtSignedPct } from "@/lib/format";
import { computeHeaderStats } from "@/lib/headerStats";
import { useAccounts } from "@/lib/hooks/useAccounts";
import { useSummary } from "@/lib/hooks/useAnalytics";
import { useCash } from "@/lib/hooks/useCash";
import { useMoneyFx } from "@/lib/hooks/useMoneyFx";
import { useTrades } from "@/lib/hooks/useTrades";
import { intlLocale } from "@/lib/locale";
import { useUI } from "@/lib/ui";
import { AccountNavPopover } from "./AccountNavPopover";
import { DateRangePicker } from "./DateRangePicker";
import { filterChipClass } from "./field-styles";
import { OptionsSelect } from "./OptionsSelect";
import { heroPnlClass } from "./theme-tokens";
import { Button } from "./ui/button";
import { Kbd } from "./ui/kbd";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from "./ui/menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

const AUTO_VALUE = "__auto__";

function HeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1 text-[13px] font-medium whitespace-nowrap">
      <span className="uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums text-foreground">{value}</span>
    </span>
  );
}

function StatDivider() {
  return (
    <span aria-hidden className="text-[13px] text-muted-foreground select-none">
      ·
    </span>
  );
}

function SymbolFilterChip({ symbols, onClear }: { symbols: string[]; onClear: () => void }) {
  const label = symbols.length <= 2 ? symbols.join(", ") : `${symbols[0]} +${symbols.length - 1}`;
  return (
    <span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-primary/25 bg-primary/10 px-2 text-[11px] text-primary">
      {label}
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        onClick={onClear}
        aria-label="Clear symbol filter"
        className="rounded-md text-primary/70 hover:bg-primary/10 hover:text-primary"
      >
        <X size={12} strokeWidth={2} />
      </Button>
    </span>
  );
}

/** `HK$ HKD Hong Kong` — the symbol alone can't separate five dollars and two yen. */
function CurrencyOptionLabel({ code, detail }: { code: string; detail?: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span className="shrink-0 text-muted-foreground">{currencySymbol(code)}</span>
      <span className="tabular-nums">{code}</span>
      {detail ? <span className="min-w-0 truncate text-muted-foreground">{detail}</span> : null}
    </span>
  );
}

/** Menu row: symbol column, code, then the issuing region as a quiet trailing hint. */
function CurrencyMenuItem({ value, code }: { value: string; code: string }) {
  const region = currencyRegion(code);
  return (
    <MenuRadioItem value={value} closeOnClick className="pe-2.5">
      <span className="flex w-full items-center gap-2">
        <span className="w-8 shrink-0 text-end text-muted-foreground">{currencySymbol(code)}</span>
        <span className="font-medium tabular-nums">{code}</span>
        {region ? (
          <span className="ms-auto min-w-0 truncate text-[11px] text-muted-foreground">
            {region}
          </span>
        ) : null}
      </span>
    </MenuRadioItem>
  );
}

export function DisplayCurrencySelect({
  baseCurrency,
  variant = "header",
  side,
}: {
  baseCurrency: string;
  variant?: "header" | "rail";
  /** Popover side; defaults to `right` for rail, `bottom` for header. */
  side?: "top" | "right" | "bottom" | "left";
}) {
  const [open, setOpen] = useState(false);
  const displayCurrency = useDisplayPrefs((s) => s.displayCurrency);
  const setDisplayCurrency = useDisplayPrefs((s) => s.setDisplayCurrency);
  const base = baseCurrency.trim().toUpperCase() || "USD";
  // `null` or an override that matches the account base = show in account currency (no FX).
  const usingAccount = displayCurrency === null || displayCurrency.toUpperCase() === base;
  const activeCode = usingAccount ? base : displayCurrency!.toUpperCase();
  const ActiveIcon = currencyIcon(activeCode);
  const popoverSide = side ?? (variant === "rail" ? "right" : "bottom");
  const tipSide = popoverSide === "right" ? "right" : "bottom";
  const tipLabel = usingAccount
    ? `Display currency · ${activeCode} (account)`
    : `Display currency · ${activeCode}`;

  const convertible = DISPLAY_CURRENCIES.filter((code) => code !== base);
  const options = [
    {
      value: AUTO_VALUE,
      label: <CurrencyOptionLabel code={base} detail="Account" />,
      shortLabel: <CurrencyOptionLabel code={base} />,
    },
    ...convertible.map((code) => ({
      value: code,
      label: <CurrencyOptionLabel code={code} detail={currencyRegion(code)} />,
      shortLabel: <CurrencyOptionLabel code={code} />,
    })),
  ];

  function applyCurrency(v: string) {
    if (v === AUTO_VALUE || v.toUpperCase() === base) {
      setDisplayCurrency(null);
      return;
    }
    if ((DISPLAY_CURRENCIES as readonly string[]).includes(v)) {
      setDisplayCurrency(v as (typeof DISPLAY_CURRENCIES)[number]);
    }
  }

  if (variant === "rail") {
    return (
      <Menu open={open} onOpenChange={setOpen}>
        <Tooltip>
          <TooltipTrigger
            render={
              <MenuTrigger
                aria-label={`Show amounts in (account ledger is ${base})`}
                className={cn(
                  "group relative flex size-8 cursor-pointer items-center justify-center rounded-md outline-none",
                  "pointer-coarse:size-11",
                  "transition-[background-color,color,transform] duration-150 ease-out",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  "motion-reduce:transition-none",
                  open || !usingAccount
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              />
            }
          >
            <ActiveIcon
              size={15}
              strokeWidth={1.75}
              className="transition-transform duration-150 ease-out group-hover:scale-105 motion-reduce:transition-none"
            />
          </TooltipTrigger>
          <TooltipContent side={tipSide}>{tipLabel}</TooltipContent>
        </Tooltip>
        <MenuPopup
          side={popoverSide}
          align="end"
          sideOffset={popoverSide === "right" ? 8 : 6}
          className="w-60"
        >
          <MenuRadioGroup
            value={usingAccount ? AUTO_VALUE : activeCode}
            onValueChange={(value) => applyCurrency(String(value))}
          >
            <MenuGroup>
              <MenuGroupLabel>Account currency</MenuGroupLabel>
              <CurrencyMenuItem value={AUTO_VALUE} code={base} />
            </MenuGroup>
            <MenuGroup>
              <MenuGroupLabel className="pt-2.5">Convert to</MenuGroupLabel>
              {convertible.map((code) => (
                <CurrencyMenuItem key={code} value={code} code={code} />
              ))}
            </MenuGroup>
          </MenuRadioGroup>
        </MenuPopup>
      </Menu>
    );
  }

  return (
    <OptionsSelect
      value={usingAccount ? AUTO_VALUE : displayCurrency!}
      onValueChange={applyCurrency}
      options={options}
      ariaLabel={`Show amounts in (account ledger is ${base})`}
      ghost
      triggerClassName={cn(filterChipClass, "min-w-[5.25rem] gap-1.5 tabular-nums")}
    />
  );
}

function PrivacyToggle() {
  const privacyMode = useDisplayPrefs((s) => s.privacyMode);
  const togglePrivacyMode = useDisplayPrefs((s) => s.togglePrivacyMode);
  const Icon = privacyMode ? EyeOff : Eye;

  return (
    <Button
      type="button"
      variant={privacyMode ? "soft" : "ghost"}
      size="icon"
      onClick={togglePrivacyMode}
      aria-pressed={privacyMode}
      aria-label={privacyMode ? "Show sensitive amounts" : "Hide sensitive amounts"}
      title={privacyMode ? "Show amounts" : "Hide amounts"}
      className={cn(
        "pointer-coarse:size-11",
        "transition-[background-color,color,border-color] duration-200 ease-[cubic-bezier(0.16, 1, 0.3, 1)]",
        !privacyMode && "bg-transparent text-muted-foreground hover:bg-accent",
      )}
    >
      <Icon size={15} strokeWidth={1.75} aria-hidden />
    </Button>
  );
}

export function HeaderBar() {
  usePrivacyMode();
  const filters = useFilterParams();
  const accountId = useFilters((s) => s.accountId);
  const setAccount = useFilters((s) => s.setAccount);
  const symbols = useFilters((s) => s.symbols);
  const setSymbols = useFilters((s) => s.setSymbols);
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
  const hasSelectedAccount = accountId
    ? accounts.some((account) => account.id === accountId)
    : true;

  useEffect(() => {
    if (!accountId) return;
    if (!hasSelectedAccount) {
      setAccount(undefined);
    }
  }, [accountId, hasSelectedAccount, setAccount]);

  // Sticky pins the strip while the document scrolls on phones; ≥md the shell
  // is viewport-height so it resolves to a no-op.
  return (
    <header className="sticky top-0 z-20 flex h-auto min-h-[52px] shrink-0 items-center gap-2 bg-background px-3 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2 md:h-[52px] md:gap-3 md:px-4 md:pt-0 md:pb-0">
      {/* Performance strip */}
      <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
        <div
          className={cn(
            heroPnlClass(stats.netPnl),
            "flex shrink-0 items-baseline gap-1.5 text-[17px] sm:text-[20px]",
            fxLoading && "opacity-60",
          )}
        >
          <span>{fmtSignedMoney(toDisplay(stats.netPnl), currency, intlLocale())}</span>
          {stats.netPnlPct != null ? (
            <span className="text-[12px] font-medium opacity-70 sm:text-[13px]">
              {fmtSignedPct(stats.netPnlPct, intlLocale())}
            </span>
          ) : null}
        </div>
        <div aria-hidden className="hidden h-7 w-px shrink-0 bg-border md:block" />
        <div className="hidden min-w-0 items-center gap-2 md:flex">
          <HeaderStat label="WR" value={summary ? fmtPct(summary.win_rate, intlLocale()) : "—"} />
          <StatDivider />
          <HeaderStat
            label="PF"
            value={summary?.profit_factor != null ? summary.profit_factor.toFixed(2) : "—"}
          />
          <StatDivider />
          <HeaderStat
            label="Balance"
            value={fmtMoney(toDisplay(stats.cash), currency, intlLocale())}
          />
        </div>
        {symbols?.length ? (
          <SymbolFilterChip symbols={symbols} onClear={() => setSymbols(undefined)} />
        ) : null}
      </div>

      {/* Command search — desktop; icon button on the right covers smaller breakpoints */}
      <div className="hidden justify-center px-1 lg:flex">
        <Button
          type="button"
          variant="outline"
          onClick={openCommandPalette}
          aria-keyshortcuts="Meta+K Control+K"
          className="w-[150px] justify-start bg-transparent px-2.5 text-foreground hover:bg-accent hover:text-foreground"
        >
          <Search size={14} strokeWidth={1.75} aria-hidden data-icon="inline-start" />
          <span className="min-w-0 flex-1 truncate text-left">Search…</span>
          <Kbd data-icon="inline-end">{APP_HOTKEYS.palette.label}</Kbd>
        </Button>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={openCommandPalette}
          aria-label="Search"
          aria-keyshortcuts="Meta+K Control+K"
          className="pointer-coarse:size-11 text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
        >
          <Search size={16} strokeWidth={1.75} aria-hidden />
        </Button>
        <div className="hidden items-center gap-1 md:flex">
          <DateRangePicker variant="rail" side="bottom" />
          <DisplayCurrencySelect baseCurrency={baseCurrency} variant="rail" side="bottom" />
        </div>
        <PrivacyToggle />
        <AccountNavPopover variant="header" />
      </div>
    </header>
  );
}
