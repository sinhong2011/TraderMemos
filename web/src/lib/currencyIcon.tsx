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

export function currencyIcon(code: string): LucideIcon {
  const key = code.trim().toUpperCase();
  return CURRENCY_ICONS[key as DisplayCurrencyCode] ?? DollarSign;
}
