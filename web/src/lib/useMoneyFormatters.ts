import { useMemo } from "react";
import { PRIVACY_MASK, usePrivacyMode } from "./displayPrefs";
import { fmtMoney, fmtMoneyCompact, fmtSignedMoney, fmtSignedMoneyCompact } from "./format";

type MoneyFormatter = (v: number, currency: string, locale: string) => string;

/**
 * Privacy-aware money formatters for components.
 *
 * The module-level `fmt*Money` functions read privacy mode from the store at
 * call time, which React Compiler cannot see: it memoizes
 * `fmtSignedMoney(pnl, currency, locale)` on the arguments alone, so flipping
 * "Hide sensitive amounts" re-renders the component and hands back the
 * pre-flip string. A bare `usePrivacyMode();` call does not help — the memo
 * cache still answers. These functions are rebound whenever privacy flips, and
 * their identity is a dependency the compiler tracks.
 */
export function useMoneyFormatters() {
  const privacy = usePrivacyMode();
  return useMemo(() => {
    const bind =
      (fmt: MoneyFormatter): MoneyFormatter =>
      (v, currency, locale) =>
        privacy ? PRIVACY_MASK : fmt(v, currency, locale);
    return {
      privacy,
      fmtMoney: bind(fmtMoney),
      fmtMoneyCompact: bind(fmtMoneyCompact),
      fmtSignedMoney: bind(fmtSignedMoney),
      fmtSignedMoneyCompact: bind(fmtSignedMoneyCompact),
    };
  }, [privacy]);
}
