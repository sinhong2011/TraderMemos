/**
 * Display-currency conversion for read-only surfaces, ported from web
 * useMoneyFx. Amounts are FX-converted from the account base currency into
 * the display override using the server's latest rate. While the rate is
 * loading (or failed), amounts keep formatting in the base currency — the
 * same number is never silently relabeled with a different symbol.
 *
 * Forms and cash entry keep using the account base currency directly.
 */

import { useFxRate } from '@/api/hooks';
import { useDisplayPrefs } from '@/lib/prefs';

export type MoneyFx = {
  baseCurrency: string;
  displayCurrency: string;
  /** Currency code to format with — base while FX is loading/failed. */
  currency: string;
  rate: number | null;
  ready: boolean;
  /** Convert a base-currency amount into the active formatting currency. */
  toDisplay: (amount: number) => number;
};

export function useMoneyFx(baseCurrency: string): MoneyFx {
  const { displayCurrency: override } = useDisplayPrefs();
  const displayCurrency = override ?? baseCurrency;
  const needsFx = baseCurrency.toUpperCase() !== displayCurrency.toUpperCase();
  const fx = useFxRate(needsFx ? baseCurrency : '', needsFx ? displayCurrency : '');

  const rate = !needsFx ? 1 : (fx.data?.rate ?? null);
  const ready = !needsFx || rate != null;

  return {
    baseCurrency,
    displayCurrency,
    currency: ready ? displayCurrency : baseCurrency,
    rate,
    ready,
    toDisplay: (amount: number) => (needsFx && rate != null ? amount * rate : amount),
  };
}
