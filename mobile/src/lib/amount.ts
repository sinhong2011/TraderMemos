/**
 * As-you-type filter for number fields: keeps digits and a single decimal
 * separator, drops everything else. `keyboardType` alone doesn't hold the line —
 * it only picks the software keyboard, so a hardware/Bluetooth keyboard, paste,
 * dictation, or an autofill suggestion can still put letters in an amount field.
 *
 * A lone comma is a decimal separator ("1,5" — what decimal-pad offers in a
 * comma-decimal locale); commas alongside a dot or each other are pasted
 * thousands grouping and drop out ("1,234.50" → 1234.50). Signs are dropped —
 * every numeric field here takes a magnitude, direction is chosen elsewhere.
 */
export function numericText(text: string, { decimals = true } = {}): string {
  // Also runs on the UI runtime: `NumericField` calls it from the native
  // state's change listener, which is what corrects a keystroke before SwiftUI
  // draws it.
  'worklet';
  const commas = text.match(/,/g)?.length ?? 0;
  const normalized =
    commas === 1 && !text.includes('.') ? text.replace(',', '.') : text.replace(/,/g, '');
  let out = '';
  let hasSeparator = false;
  for (const char of normalized) {
    if (char >= '0' && char <= '9') {
      out += char;
    } else if (decimals && !hasSeparator && char === '.') {
      hasSeparator = true;
      out += '.';
    }
  }
  return out;
}

/**
 * Wraps a text handler so a field that asks for a numeric keyboard can only
 * ever report numeric text — the one place the shared inputs (`InputRow`,
 * `FormInput`) apply `numericText`, so no call site has to remember.
 */
export function filterByKeyboard(
  keyboardType: string | undefined,
  onChangeText: ((text: string) => void) | undefined,
) {
  if (!onChangeText) return onChangeText;
  if (keyboardType === 'decimal-pad') return (text: string) => onChangeText(numericText(text));
  if (keyboardType === 'number-pad') {
    return (text: string) => onChangeText(numericText(text, { decimals: false }));
  }
  return onChangeText;
}

/** "1234.5" → number, '' → null; NaN/negative → undefined (reject upstream with an alert). */
export function parseAmount(text: string): number | null | undefined {
  const trimmed = text.trim().replace(/,/g, '');
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}
