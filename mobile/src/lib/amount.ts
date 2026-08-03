/** "1234.5" → number, '' → null; NaN/negative → undefined (reject upstream with an alert). */
export function parseAmount(text: string): number | null | undefined {
  const trimmed = text.trim().replace(/,/g, '');
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}
