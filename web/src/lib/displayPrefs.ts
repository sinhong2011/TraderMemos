import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Account } from "./api/types";

export const DISPLAY_PREFS_STORAGE_KEY = "tm-display-prefs";

/** Currencies offered in the header display switch. */
export const DISPLAY_CURRENCIES = [
  "USD",
  "HKD",
  "TWD",
  "CNY",
  "EUR",
  "GBP",
  "JPY",
  "AUD",
  "SGD",
] as const;

export type DisplayCurrencyCode = (typeof DISPLAY_CURRENCIES)[number];

/** `null` = follow the selected account's base currency. */
export type DisplayCurrencyOverride = DisplayCurrencyCode | null;

export const PRIVACY_MASK = "••••";

function isDisplayCurrencyCode(value: string): value is DisplayCurrencyCode {
  return (DISPLAY_CURRENCIES as readonly string[]).includes(value);
}

interface DisplayPrefsState {
  /**
   * Display currency override for read-only UI.
   * Amounts are FX-converted from account base → display using latest rates.
   * `null` follows the selected account's base currency (no conversion).
   */
  displayCurrency: DisplayCurrencyOverride;
  /** When true, money formatters render a mask instead of amounts. */
  privacyMode: boolean;
  setDisplayCurrency: (currency: DisplayCurrencyOverride) => void;
  setPrivacyMode: (on: boolean) => void;
  togglePrivacyMode: () => void;
}

export const useDisplayPrefs = create<DisplayPrefsState>()(
  persist(
    (set) => ({
      displayCurrency: null,
      privacyMode: false,
      setDisplayCurrency: (displayCurrency) => set({ displayCurrency }),
      setPrivacyMode: (privacyMode) => set({ privacyMode }),
      togglePrivacyMode: () => set((s) => ({ privacyMode: !s.privacyMode })),
    }),
    {
      name: DISPLAY_PREFS_STORAGE_KEY,
      partialize: (s) => ({
        displayCurrency: s.displayCurrency,
        privacyMode: s.privacyMode,
      }),
      merge: (persisted, current) => {
        const raw = persisted as (Partial<DisplayPrefsState> & { currency?: string }) | undefined;
        // Migrate older `currency` key → `displayCurrency` override.
        let displayCurrency: DisplayCurrencyOverride = current.displayCurrency;
        if (raw && "displayCurrency" in raw) {
          const v = raw.displayCurrency;
          displayCurrency =
            v === null || v === undefined
              ? null
              : isDisplayCurrencyCode(v)
                ? v
                : current.displayCurrency;
        } else if (raw?.currency && isDisplayCurrencyCode(raw.currency)) {
          displayCurrency = raw.currency;
        }
        return {
          ...current,
          displayCurrency,
          privacyMode:
            typeof raw?.privacyMode === "boolean" ? raw.privacyMode : current.privacyMode,
        };
      },
    },
  ),
);

/** Account ledger currency — source of truth for stored amounts / forms. */
export function accountBaseCurrency(
  accounts: readonly Pick<Account, "id" | "base_currency">[],
  accountId?: string,
  fallback = "USD",
): string {
  if (!accountId) return fallback;
  return accounts.find((a) => a.id === accountId)?.base_currency ?? fallback;
}

/** Prefer display override; otherwise use account base. */
export function resolveDisplayCurrency(baseCurrency: string): string {
  return useDisplayPrefs.getState().displayCurrency ?? baseCurrency;
}

/**
 * Money formatting currency for read-only UI surfaces.
 * Forms / cash entry should keep using `accountBaseCurrency`.
 */
export function useDisplayCurrency(baseCurrency: string): string {
  const override = useDisplayPrefs((s) => s.displayCurrency);
  return override ?? baseCurrency;
}

export function isPrivacyMode(): boolean {
  return useDisplayPrefs.getState().privacyMode;
}

/**
 * Subscribe to privacy mode in any component that renders `fmtMoney*`.
 * Formatters read privacy via `getState()` at render time. Under React Compiler,
 * parent subscriptions do not remask memoized children — call this in the same
 * component that formats money (or a leaf like MoneyCell).
 */
export function usePrivacyMode(): boolean {
  return useDisplayPrefs((s) => s.privacyMode);
}
