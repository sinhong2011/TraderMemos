/**
 * P&L color helpers for the PanelUI/Uniwind theme.
 *
 * Components color P&L *text* with the utility classes (`text-profit`,
 * `text-loss`, `text-flat`) via `pnlClass`. Anything that needs the value in
 * JavaScript — chart series, heatmap tints, icon colors — reads the live
 * tokens with `usePnlPalette()`, which subscribes to theme changes.
 */

import { useCSSVariable } from 'uniwind';

export interface PnlPalette {
  profit: string;
  loss: string;
  flat: string;
  open: string;
}

/** Live P&L hues from the theme tokens; re-renders on scheme change. */
export function usePnlPalette(): PnlPalette {
  const [profit, loss, flat, open] = useCSSVariable([
    '--color-profit',
    '--color-loss',
    '--color-flat',
    '--color-open',
  ]) as [string, string, string, string];
  return { profit, loss, flat, open };
}

/** Utility class for P&L text, honoring the flat/zero case. */
export function pnlClass(value: number | null | undefined): 'text-profit' | 'text-loss' | 'text-flat' {
  if (value == null || value === 0) return 'text-flat';
  return value > 0 ? 'text-profit' : 'text-loss';
}

/** Returns the P&L color for a value, honoring the flat/zero case. */
export function pnlColor(palette: PnlPalette, value: number | null | undefined): string {
  if (value == null || value === 0) return palette.flat;
  return value > 0 ? palette.profit : palette.loss;
}

/**
 * Saturated P&L fills for solid, white-on-color surfaces (outcome badges, the
 * Long/Short and Buy/Sell toggles) — the light-scheme hues in both themes,
 * because white text needs the saturation and a same-in-both-modes fill is the
 * Stocks-app signature those surfaces borrow. Deliberately not theme tokens:
 * `profit`/`loss` lighten in the dark theme for *text*, where that is what
 * keeps them legible.
 */
export const PnlFill = {
  pos: '#098926',
  neg: '#E7000B',
  flat: '#737373',
  open: '#0490C8',
} as const;

/**
 * Translucent P&L surface tint for calendar heatmap cells: profit/loss hue
 * with alpha scaled by magnitude relative to the month's largest day.
 */
export function pnlBgTint(palette: PnlPalette, value: number, maxAbs: number): string {
  const base = value > 0 ? palette.profit : palette.loss;
  const intensity = maxAbs > 0 ? Math.min(1, Math.abs(value) / maxAbs) : 0;
  // Capped so profit/loss text keeps ~4.5:1 on the deepest wash; green is
  // damped for luminance parity — at equal alpha it reads far louder than red.
  const parity = value > 0 ? 0.85 : 1;
  const alpha = Math.round((0.08 + 0.16 * intensity) * parity * 255);
  return `${base}${alpha.toString(16).padStart(2, '0')}`;
}

/**
 * Vivid P&L fill for heatmap dots that never carry text — the quiet
 * `pnlBgTint` ramp reads as noise at dot size, so these run much hotter.
 */
export function pnlDotTint(palette: PnlPalette, value: number, maxAbs: number): string {
  const base = value > 0 ? palette.profit : palette.loss;
  const intensity = maxAbs > 0 ? Math.min(1, Math.abs(value) / maxAbs) : 0;
  const alpha = Math.round((0.3 + 0.6 * intensity) * 255);
  return `${base}${alpha.toString(16).padStart(2, '0')}`;
}
