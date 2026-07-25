import { useQuery } from "@tanstack/react-query";
import { marketApi } from "@/lib/api/market";
import { useDisplayCurrency } from "@/lib/displayPrefs";

/** Latest FX: 1 `from` = `rate` `to`. Skips the network when currencies match. */
export function useFxRate(from: string, to: string) {
  const base = from.trim().toUpperCase();
  const quote = to.trim().toUpperCase();
  const same = Boolean(base) && base === quote;

  return useQuery({
    queryKey: ["fx-rate", base, quote],
    queryFn: () => marketApi.fx({ from: base, to: quote }),
    enabled: Boolean(base && quote) && !same,
    staleTime: 15 * 60_000,
    gcTime: 60 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

/**
 * Convert account-base amounts into the selected display currency using latest FX.
 * If rates are unavailable, falls back to formatting in the account base currency
 * (never silently relabels the same number with a different currency symbol).
 */
export function useMoneyFx(baseCurrency: string) {
  const displayCurrency = useDisplayCurrency(baseCurrency);
  const needsFx = baseCurrency.toUpperCase() !== displayCurrency.toUpperCase();
  const fxQ = useFxRate(baseCurrency, displayCurrency);

  const rate = !needsFx ? 1 : (fxQ.data?.rate ?? null);
  const ready = !needsFx || rate != null;
  /** Currency code used for formatting — base while FX is loading/failed. */
  const currency = ready ? displayCurrency : baseCurrency;

  return {
    baseCurrency,
    displayCurrency,
    currency,
    rate,
    ready,
    isLoading: needsFx && fxQ.isLoading,
    isError: needsFx && fxQ.isError,
    /** Convert a base-currency amount into the active formatting currency. */
    toDisplay: (amount: number): number => {
      if (!needsFx) return amount;
      if (rate == null) return amount;
      return amount * rate;
    },
  };
}

export function convertAmount(amount: number, rate: number): number {
  return amount * rate;
}
