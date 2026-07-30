import type { LucideIcon } from "lucide-react";
import { DollarSign, Euro, JapaneseYen, PoundSterling } from "lucide-react";
import type { DisplayCurrencyCode } from "./displayPrefs";

/** Lucide glyph for a display-currency code (shared ¥ for CNY/JPY). */
const CURRENCY_ICONS: Record<DisplayCurrencyCode, LucideIcon> = {
  USD: DollarSign,
  HKD: DollarSign,
  TWD: DollarSign,
  SGD: DollarSign,
  AUD: DollarSign,
  CNY: JapaneseYen,
  JPY: JapaneseYen,
  EUR: Euro,
  GBP: PoundSterling,
};

/**
 * Disambiguated symbols — five of the offered currencies are dollars and two are
 * yen, so the bare glyph cannot tell them apart in a list.
 * Pinned rather than derived because `Intl` narrow symbols collapse to `$` / `¥`
 * and its wide symbols vary by locale (SGD renders as the code in en-US).
 */
const CURRENCY_SYMBOLS: Record<DisplayCurrencyCode, string> = {
  USD: "$",
  HKD: "HK$",
  TWD: "NT$",
  CNY: "CN¥",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  AUD: "A$",
  SGD: "S$",
};

/** Issuing region — the plain-language half of the code (`HKD` → Hong Kong). */
const CURRENCY_REGIONS: Record<DisplayCurrencyCode, string> = {
  USD: "United States",
  HKD: "Hong Kong",
  TWD: "Taiwan",
  CNY: "China",
  EUR: "Euro area",
  GBP: "United Kingdom",
  JPY: "Japan",
  AUD: "Australia",
  SGD: "Singapore",
};

function normalize(code: string): string {
  return code.trim().toUpperCase();
}

export function currencyIcon(code: string): LucideIcon {
  return CURRENCY_ICONS[normalize(code) as DisplayCurrencyCode] ?? DollarSign;
}

/**
 * Short symbol for a currency code. Accounts may hold a currency outside the
 * display switch (e.g. `CAD`), so unlisted codes fall back to the Intl symbol.
 */
export function currencySymbol(code: string): string {
  const key = normalize(code);
  const pinned = CURRENCY_SYMBOLS[key as DisplayCurrencyCode];
  if (pinned) return pinned;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: key,
      currencyDisplay: "symbol",
      maximumFractionDigits: 0,
    })
      .format(0)
      .replace(/[\d\s.,]/g, "");
  } catch {
    return "";
  }
}

/** Issuing region, or `undefined` for codes outside the display switch. */
export function currencyRegion(code: string): string | undefined {
  return CURRENCY_REGIONS[normalize(code) as DisplayCurrencyCode];
}
